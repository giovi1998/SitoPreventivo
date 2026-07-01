import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import './QREditor.css';
import PreviewWatermark from './PreviewWatermark';
import { useDocumentSave } from '../hooks/useDocumentSave';
import type { QRCode as QRCodeType, QrCodeData, QrStyle, QrDotStyle, QrErrorCorrection } from '../utils/documentSchemas';
import { createEmptyQrCode, createGiovanniQrTemplate, mergeQrWithDefaults } from '../utils/documentSchemas';
import {
  buildQrPayload,
  generateQrSvg,
  generateQrPng,
  validateQrContrast,
  isHexColor,
  isHttpUrl,
  isAllowedLogoMime,
  ALLOWED_LOGO_MIME,
  ERROR_CORRECTION_LEVELS,
  DOT_STYLES,
} from '../utils/qrGenerator';
import dataService from '../utils/dataService';
import SaveDialog from './SaveDialog';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

const TYPE_LABELS: Record<QrCodeData['type'], string> = {
  url: 'URL',
  text: 'Testo',
  email: 'Email',
  phone: 'Telefono',
  vcard: 'Contatto (vCard)',
  wifi: 'WiFi',
  sms: 'SMS',
};

const TEMPLATE_GIOVANNI_URL = 'https://webdeveloperca.netlify.app/';
const MAX_LOGO_BYTES = 100 * 1024;
const MAX_RAW_LOGO_BYTES = 500 * 1024;
const MAX_TEXT_PAYLOAD = 500;

interface QREditorProps {
  userEmail: string;
  initialQr?: QRCodeType;
  onSaveAsTemplate?: (qr: QRCodeType) => void;
  tier?: 'free' | 'unlocked';
}

export default function QREditor({ userEmail, initialQr, onSaveAsTemplate, tier = 'unlocked' }: QREditorProps) {
  const { save: saveDocumentGuarded } = useDocumentSave();
  // Deep-merge with createEmptyQrCode() defaults: a saved QR without
  // `style` (legacy, partial save, or schema drift) used to crash the
  // first render with `Cannot read properties of undefined (reading
  // 'fgColor')` at `qr.style.fgColor`. The Zod defaults are only applied
  // by .parse(), so we apply them manually here.
  const [qr, setQr] = useState<QRCodeType>(() => mergeQrWithDefaults(initialQr));
  const [showTemplateBanner, setShowTemplateBanner] = useState<boolean>(() => !initialQr);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [svgPreview, setSvgPreview] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'png' | 'svg' | null>(null);
  const previewRenderIdRef = useRef(0);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addToast } = useToast();

  const debouncedQr = useDebouncedValue(qr, 300);

  const contrastOk = useMemo(
    () => validateQrContrast(qr.style.fgColor, qr.style.bgColor),
    [qr.style.fgColor, qr.style.bgColor],
  );

  useEffect(() => {
    const renderId = ++previewRenderIdRef.current;
    setPreviewError(null);
    // generateQrSvg è sincrono: la libreria qrcode espone QRCode.create()
    // sincrono, quindi la promise era solo overhead. Sincronizzando qui
    // evito un frame di placeholder vuoto al primo render del QR.
    try {
      const svg = generateQrSvg(debouncedQr);
      if (renderId !== previewRenderIdRef.current) return;
      setSvgPreview(svg);
    } catch (err) {
      if (renderId !== previewRenderIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Anteprima non disponibile';
      setPreviewError(message);
      setSvgPreview('');
    }
  }, [debouncedQr]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const sanitized = sanitizeForSave(qr, userEmail);
      if (qr.data.payload) {
        // Phase 5: use guarded save which checks the free-tier doc limit
        // and triggers the TierLimitModal if reached.
        saveDocumentGuarded(userEmail, sanitized).then((result) => {
          if (result.blocked) {
            addToast('info', 'Limite piano free raggiunto. Sblocca per continuare.');
          } else if (result.error) {
            logger.error('QR auto-save failed', { err: result.error });
          }
        });
      }
    }, 30000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [qr, userEmail, saveDocumentGuarded]);

  const updateData = useCallback((patch: Partial<QrCodeData>) => {
    setQr((prev) => ({
      ...prev,
      data: { ...prev.data, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateStyle = useCallback((patch: Partial<QrStyle>) => {
    setQr((prev) => ({
      ...prev,
      style: { ...prev.style, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const updateTitle = useCallback((title: string) => {
    setQr((prev) => ({ ...prev, title, updatedAt: new Date().toISOString() }));
  }, []);

  const handleTypeChange = useCallback((newType: QrCodeData['type']) => {
    setQr((prev) => ({
      ...prev,
      data: { type: newType, payload: '' },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const applyGiovanniTemplate = useCallback(() => {
    setQr(createGiovanniQrTemplate());
    setShowTemplateBanner(false);
    addToast('info', 'Template personale Giovanni caricato');
  }, [addToast]);

  const handleLogoUpload = useCallback((file: File) => {
    setLogoError(null);
    if (!isAllowedLogoMime(file.type)) {
      setLogoError('Formato non supportato. Usa PNG, JPEG o SVG.');
      return;
    }
    if (file.size > MAX_RAW_LOGO_BYTES) {
      setLogoError('File troppo grande. Max 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUri = String(reader.result || '');
      if (dataUri.length > MAX_LOGO_BYTES * 4 / 3) {
        setLogoError('Logo troppo pesante anche dopo compressione. Usa un\'immagine più semplice.');
        return;
      }
      updateStyle({ logoOverlay: dataUri });
    };
    reader.onerror = () => setLogoError('Errore lettura file.');
    reader.readAsDataURL(file);
  }, [updateStyle]);

  const removeLogo = useCallback(() => {
    updateStyle({ logoOverlay: null });
    setLogoError(null);
  }, [updateStyle]);

  const exportPng = useCallback(async () => {
    setExporting('png');
    try {
      const bytes = await generateQrPng(qr, { tier });
      const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr_${qr.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'PNG scaricato');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export PNG';
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [qr, tier, addToast]);

  const exportSvg = useCallback(() => {
    setExporting('svg');
    try {
      const svg = generateQrSvg(qr);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qr_${qr.id}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('success', 'SVG scaricato');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Errore export SVG';
      addToast('error', message);
    } finally {
      setExporting(null);
    }
  }, [qr, addToast]);

  const handleSave = useCallback((customName: string) => {
    const title = customName || qr.title || 'QR Code';
    const toSave: QRCodeType = sanitizeForSave({ ...qr, title }, userEmail);
    dataService.saveDocument(userEmail, toSave)
      .then((result) => {
        if (result.error) {
          addToast('error', result.error);
          return;
        }
        setQr(toSave);
        addToast('success', `«${title}» salvato`);
      })
      .catch((err) => addToast('error', (err as Error).message || 'Errore salvataggio'));
  }, [qr, userEmail, addToast]);

  const openSaveDialog = useCallback(() => {
    if (!qr.data.payload) {
      addToast('info', 'Compila almeno il payload prima di salvare.');
      return;
    }
    setShowSaveDialog(true);
  }, [qr.data.payload, addToast]);

  const renderPayloadFields = () => {
    switch (qr.data.type) {
      case 'url':
        return <UrlFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'text':
        return <TextFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'email':
        return <EmailFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'phone':
        return <PhoneFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'vcard':
        return <VcardFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'wifi':
        return <WifiFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
      case 'sms':
        return <SmsFields value={qr.data.payload} onChange={(v) => updateData({ payload: v })} />;
    }
  };

  return (
    <div className="qr-editor">
      <header className="qr-editor-header">
        <h1>QR Code</h1>
        <input
          className="qr-title-input"
          value={qr.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="Titolo del QR"
          aria-label="Titolo del QR"
        />
      </header>

      {showTemplateBanner && (
        <div className="qr-template-banner" role="status">
          <span>Usa template personale di Giovanni (precompilato con {TEMPLATE_GIOVANNI_URL})</span>
          <button type="button" onClick={applyGiovanniTemplate}>Applica template</button>
          <button type="button" onClick={() => setShowTemplateBanner(false)} aria-label="Chiudi banner">×</button>
        </div>
      )}

      <div className="qr-editor-grid">
        <section className="qr-editor-form" aria-label="Configurazione QR">
          <fieldset className="qr-fieldset">
            <legend>Tipo di contenuto</legend>
            <label className="qr-field">
              <span>Tipo</span>
              <select
                value={qr.data.type}
                onChange={(e) => handleTypeChange(e.target.value as QrCodeData['type'])}
                aria-label="Tipo payload QR"
              >
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="qr-fieldset">
            <legend>Dati</legend>
            {renderPayloadFields()}
          </fieldset>

          <fieldset className="qr-fieldset">
            <legend>Stile</legend>
            <ColorField
              id="qr-fg"
              label="Colore principale"
              value={qr.style.fgColor}
              onChange={(v) => updateStyle({ fgColor: v })}
            />
            <ColorField
              id="qr-bg"
              label="Sfondo"
              value={qr.style.bgColor}
              onChange={(v) => updateStyle({ bgColor: v })}
            />
            {!contrastOk && (
              <p className="qr-warning" role="alert">
                Contrasto insufficiente (WCAG AA non soddisfatto).
              </p>
            )}
            <label className="qr-field">
              <span>Correzione errori ({qr.style.errorCorrection})</span>
              <select
                value={qr.style.errorCorrection}
                onChange={(e) => updateStyle({ errorCorrection: e.target.value as QrErrorCorrection })}
                aria-label="Livello correzione errori"
              >
                {ERROR_CORRECTION_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </label>
            <label className="qr-field">
              <span>Stile moduli ({qr.style.dotStyle})</span>
              <select
                value={qr.style.dotStyle}
                onChange={(e) => updateStyle({ dotStyle: e.target.value as QrDotStyle })}
                aria-label="Stile moduli QR"
              >
                {DOT_STYLES.map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </label>
            <label className="qr-field">
              <span>Dimensione: {qr.style.size}px</span>
              <input
                type="range"
                min={128}
                max={2048}
                step={32}
                value={qr.style.size}
                onChange={(e) => updateStyle({ size: Number(e.target.value) })}
                aria-label="Dimensione QR in pixel"
              />
            </label>
            <label className="qr-field">
              <span>Margine: {qr.style.margin}</span>
              <input
                type="range"
                min={0}
                max={16}
                step={1}
                value={qr.style.margin}
                onChange={(e) => updateStyle({ margin: Number(e.target.value) })}
                aria-label="Margine QR"
              />
            </label>
            <div className="qr-field">
              <span>Logo overlay (opzionale)</span>
              <input
                type="file"
                accept={ALLOWED_LOGO_MIME.join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoUpload(file);
                }}
                aria-label="Carica logo overlay"
              />
              {qr.style.logoOverlay && (
                <button type="button" className="qr-remove-logo" onClick={removeLogo}>
                  Rimuovi logo
                </button>
              )}
              {logoError && <p className="qr-warning" role="alert">{logoError}</p>}
            </div>
          </fieldset>

          <div className="qr-actions">
            <button type="button" onClick={openSaveDialog}>Salva</button>
            <button type="button" onClick={exportPng} disabled={exporting === 'png' || !qr.data.payload}>
              {exporting === 'png' ? 'Esportando…' : 'Scarica PNG'}
            </button>
            <button type="button" onClick={exportSvg} disabled={exporting === 'svg' || !qr.data.payload}>
              {exporting === 'svg' ? 'Esportando…' : 'Scarica SVG'}
            </button>
            {onSaveAsTemplate && (
              <button type="button" onClick={() => onSaveAsTemplate(qr)}>
                Salva come template
              </button>
            )}
          </div>
        </section>

        <section className="qr-editor-preview" aria-label="Anteprima QR">
          <h2>Anteprima</h2>
          {previewError ? (
            <div className="qr-preview-error" role="alert">{previewError}</div>
          ) : (
            <div className="qr-preview-wrap" data-tier={tier} data-testid="qr-preview-wrap">
              <div
                className="qr-preview-svg"
                role="img"
                aria-label={`QR code ${qr.data.type}: ${qr.data.payload || 'vuoto'}`}
                dangerouslySetInnerHTML={{ __html: svgPreview }}
              />
              <PreviewWatermark tier={tier} />
            </div>
          )}
          <p className="qr-payload-summary">
            <strong>Payload:</strong> <code>{buildQrPayload(qr.data) || '(vuoto)'}</code>
          </p>
        </section>
      </div>

      <SaveDialog
        open={showSaveDialog}
        defaultName={qr.title || 'QR Code'}
        documentLabel="QR Code"
        placeholder="Es. QR Code - Sito Web"
        onSave={(name) => {
          setShowSaveDialog(false);
          handleSave(name);
        }}
        onCancel={() => setShowSaveDialog(false)}
      />
    </div>
  );
}

function UrlFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = !value || isHttpUrl(value);
  return (
    <label className="qr-field">
      <span>URL (http:// o https://)</span>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com"
        aria-invalid={!valid}
        aria-label="URL del QR code"
      />
      {!valid && <small className="qr-warning">URL non valido. Includi http:// o https://</small>}
    </label>
  );
}

function TextFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const remaining = MAX_TEXT_PAYLOAD - value.length;
  return (
    <label className="qr-field">
      <span>Testo ({remaining} caratteri rimasti)</span>
      <textarea
        rows={4}
        value={value}
        maxLength={MAX_TEXT_PAYLOAD}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Testo libero del QR"
      />
    </label>
  );
}

function EmailFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [email = '', subject = ''] = value.split('|');
  return (
    <>
      <label className="qr-field">
        <span>Email destinatario</span>
        <input
          type="email"
          value={email}
          onChange={(e) => onChange(`${e.target.value}|${subject}`)}
          placeholder="nome@esempio.com"
          aria-label="Email del QR"
        />
      </label>
      <label className="qr-field">
        <span>Oggetto (opzionale)</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => onChange(`${email}|${e.target.value}`)}
          aria-label="Oggetto email"
        />
      </label>
    </>
  );
}

function PhoneFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const valid = !value || /^\+?[0-9\s-]{4,20}$/.test(value);
  return (
    <label className="qr-field">
      <span>Numero (formato internazionale, es. +39 333 1234567)</span>
      <input
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!valid}
        aria-label="Numero di telefono del QR"
      />
      {!valid && <small className="qr-warning">Numero non valido</small>}
    </label>
  );
}

function VcardFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.split('|');
  const [firstName = '', lastName = '', org = '', role = '', phone = '', email = ''] = parts;
  const update = (idx: number, v: string) => {
    const next = [...parts];
    next[idx] = v;
    onChange(next.join('|'));
  };
  return (
    <>
      <label className="qr-field"><span>Nome</span>
        <input value={firstName} onChange={(e) => update(0, e.target.value)} aria-label="Nome" />
      </label>
      <label className="qr-field"><span>Cognome</span>
        <input value={lastName} onChange={(e) => update(1, e.target.value)} aria-label="Cognome" />
      </label>
      <label className="qr-field"><span>Organizzazione</span>
        <input value={org} onChange={(e) => update(2, e.target.value)} aria-label="Organizzazione" />
      </label>
      <label className="qr-field"><span>Ruolo</span>
        <input value={role} onChange={(e) => update(3, e.target.value)} aria-label="Ruolo" />
      </label>
      <label className="qr-field"><span>Telefono</span>
        <input value={phone} onChange={(e) => update(4, e.target.value)} aria-label="Telefono vCard" />
      </label>
      <label className="qr-field"><span>Email</span>
        <input type="email" value={email} onChange={(e) => update(5, e.target.value)} aria-label="Email vCard" />
      </label>
    </>
  );
}

function WifiFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = value.split('|');
  const [ssid = '', password = '', encryption = 'WPA'] = parts;
  const update = (idx: number, v: string) => {
    const next = [...parts];
    next[idx] = v;
    onChange(next.join('|'));
  };
  return (
    <>
      <label className="qr-field"><span>SSID (nome rete)</span>
        <input value={ssid} onChange={(e) => update(0, e.target.value)} aria-label="SSID WiFi" />
      </label>
      <label className="qr-field"><span>Password</span>
        <input type="password" value={password} onChange={(e) => update(1, e.target.value)} aria-label="Password WiFi" autoComplete="off" />
      </label>
      <label className="qr-field"><span>Tipo di crittografia</span>
        <select value={encryption} onChange={(e) => update(2, e.target.value)} aria-label="Tipo crittografia WiFi">
          <option value="WPA">WPA/WPA2</option>
          <option value="WEP">WEP</option>
          <option value="nopass">Nessuna</option>
        </select>
      </label>
    </>
  );
}

function SmsFields({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [number = '', message = ''] = value.split('|');
  return (
    <>
      <label className="qr-field"><span>Numero destinatario</span>
        <input type="tel" value={number} onChange={(e) => onChange(`${e.target.value}|${message}`)} aria-label="Numero SMS" />
      </label>
      <label className="qr-field"><span>Messaggio</span>
        <textarea rows={3} value={message} onChange={(e) => onChange(`${number}|${e.target.value}`)} aria-label="Messaggio SMS" />
      </label>
    </>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const valid = isHexColor(value);
  return (
    <label className="qr-field qr-color-field">
      <span>{label}</span>
      <div className="qr-color-row">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} selettore colore`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!valid}
          aria-label={`${label} esadecimale`}
        />
      </div>
    </label>
  );
}

function sanitizeForSave(qr: QRCodeType, userEmail: string): QRCodeType {
  // Merge with default style: ensures every saved QR has all
  // required fields even if the state was reconstructed from a
  // partial document. Also strips `logoOverlay` for non-wifi types
  // (only wifi keeps the logo overlay, others always null).
  const baseStyle = createEmptyQrCode().style;
  return {
    ...qr,
    userEmail,
    style: {
      ...baseStyle,
      ...qr.style,
      logoOverlay: qr.data.type === 'wifi' ? qr.style.logoOverlay : null,
    },
    updatedAt: new Date().toISOString(),
  };
}
