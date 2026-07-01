import React, { useState } from 'react';
import { PROFESSIONI } from '../utils/defaultTemplates';
import './OnboardingModal.css';

export type PreferredDocumentType = 'editor' | 'qr' | 'card' | 'flyer' | 'logo';

interface OnboardingData {
  displayName: string;
  companyName: string;
  profession: string;
  defaultColor: string;
  defaultVat: number;
  onboardingDone: boolean;
  preferredDocumentType?: PreferredDocumentType;
}

interface OnboardingModalProps {
  onComplete: (data: OnboardingData) => void;
  // Phase 7 polish. Non-admin users cannot create preventivi, so the
  // wizard is shorter (no IVA step) and the "Preventivo" option in
  // the document picker is hidden. Default: non-admin (safer for tests
  // that do not provide an AuthContext).
  isAdmin?: boolean;
}

const BRAND_COLORS = ["#0B57D0","#11845B","#6D3FD1","#A66200","#D64545","#B83280","#0F766E","#334155","#4F46E5","#5B7F22"];
const VAT_OPTIONS = [
  { value: 22, label: '22%' },
  { value: 26, label: '26%' },
  { value: 10, label: '10%' },
  { value: 4, label: '4%' },
  { value: 0, label: '0%' },
];

// Phase 7 + Phase 3. Volantino is now implemented (see AGENTS.md
// "Phase 3 implementata"). The full option list is defined once and
// filtered at render time by isAdmin.
const ALL_DOCUMENT_OPTIONS: Array<{
  id: PreferredDocumentType;
  label: string;
  icon: React.ReactNode;
  enabled: boolean;
  badge?: string;
}> = [
  {
    id: 'editor',
    label: 'Preventivo',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
  },
  {
    id: 'qr',
    label: 'QR Code',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="3" height="3" />
        <line x1="21" y1="14" x2="21" y2="17" />
        <line x1="14" y1="21" x2="17" y2="21" />
        <line x1="21" y1="19" x2="21" y2="21" />
      </svg>
    ),
  },
  {
    id: 'card',
    label: 'Bigliettino',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
        <line x1="14" y1="15" x2="18" y2="15" />
      </svg>
    ),
  },
  {
    id: 'flyer',
    label: 'Volantino',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="14" y2="17" />
      </svg>
    ),
  },
  {
    id: 'logo',
    label: 'Logo',
    enabled: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2 L19 7 L19 17 L12 22 L5 17 L5 7 Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

// Step definitions. The IVA step is only present for admin (preventivi
// are admin-only). The preference step is always last.
function buildSteps(isAdmin: boolean) {
  const base: Array<{ title: string; subtitle: string; key: 'name' | 'company' | 'profession' | 'color' | 'vat' | 'preference' }> = [
    {
      key: 'name',
      title: 'Benvenuto!',
      subtitle: 'PrecisionQuote è la suite di branding per la tua attività. QR, bigliettini e logo, pronti per la stampa.',
    },
    {
      key: 'company',
      title: 'Il tuo business',
      subtitle: 'Nome della tua azienda o studio?',
    },
    {
      key: 'profession',
      title: 'Di che settore sei?',
      subtitle: 'Scegli una opzione (ti suggeriremo template su misura)',
    },
    {
      key: 'color',
      title: 'Colore brand',
      subtitle: 'Scegli il colore predefinito',
    },
  ];
  if (isAdmin) {
    base.push({
      key: 'vat',
      title: 'IVA predefinita',
      subtitle: 'Quale aliquota usi di solito?',
    });
  }
  base.push({
    key: 'preference',
    title: 'Cosa vuoi creare per primo?',
    subtitle: 'Scegli un documento: si apre subito dopo. Puoi cambiarlo quando vuoi.',
  });
  return base;
}

export default function OnboardingModal({ onComplete, isAdmin = false }: OnboardingModalProps) {
  const steps = buildSteps(isAdmin);
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [profession, setProfession] = useState<string>('');
  const [defaultColor, setDefaultColor] = useState('#E62020');
  const [defaultVat, setDefaultVat] = useState(22);
  const [preferredDocumentType, setPreferredDocumentType] = useState<PreferredDocumentType | null>(null);

  const documentOptions = ALL_DOCUMENT_OPTIONS.filter((o) => isAdmin || o.id !== 'editor');

  const finish = (override?: PreferredDocumentType | null) => {
    const choice = override !== undefined ? override : preferredDocumentType;
    onComplete({
      displayName,
      companyName,
      profession,
      defaultColor,
      defaultVat,
      onboardingDone: true,
      preferredDocumentType: choice || undefined,
    });
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else finish();
  };

  const skipPreference = () => finish(null);

  const currentKey = steps[step]?.key;
  const canAdvance = currentKey === 'name'
    ? displayName.trim().length > 0
    : currentKey === 'profession'
      ? profession !== ''
      : true;

  const selectProfession = (id: string) => setProfession(id);
  const selectDocument = (id: PreferredDocumentType) => setPreferredDocumentType(id);
  const isPreferenceStep = currentKey === 'preference';

  return (
    <div className="onb-overlay">
      <div className="onb-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="onb-progress">
          <div className="onb-progress-bars">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`onb-progress-bar${i <= step ? ' is-on' : ''}`}
                aria-hidden="true"
              />
            ))}
          </div>
          <span className="onb-progress-count">{step + 1}/{steps.length}</span>
        </div>

        <h2 className="onb-title">{steps[step].title}</h2>
        <p className="onb-subtitle">{steps[step].subtitle}</p>

        {currentKey === 'name' && (
          <input
            type="text"
            autoFocus
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canAdvance && next()}
            placeholder="Es. Marco"
            className="onb-input"
          />
        )}

        {currentKey === 'company' && (
          <input
            type="text"
            autoFocus
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && next()}
            placeholder="Es. Studio Rossi Design"
            className="onb-input"
          />
        )}

        {currentKey === 'profession' && (
          <div className="onb-profession-grid">
            {PROFESSIONI.map((p) => {
              const selected = profession === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProfession(p.id)}
                  className={`onb-choice${selected ? ' is-selected' : ''}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        {currentKey === 'color' && (
          <div className="onb-color-grid">
            {BRAND_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setDefaultColor(c)}
                aria-label={`Colore ${c}`}
                className={`onb-swatch${defaultColor === c ? ' is-selected' : ''}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}

        {currentKey === 'vat' && (
          <div className="onb-vat-grid">
            {VAT_OPTIONS.map((v) => (
              <button
                key={v.value}
                type="button"
                onClick={() => setDefaultVat(v.value)}
                className={`onb-choice onb-choice--big${defaultVat === v.value ? ' is-selected' : ''}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        {currentKey === 'preference' && (
          <div className="onb-doc-grid" role="radiogroup" aria-label="Documento preferito">
            {documentOptions.map((opt) => {
              const isSelected = preferredDocumentType === opt.id;
              const isDisabled = !opt.enabled;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && selectDocument(opt.id as PreferredDocumentType)}
                  className={`onb-doc-card${isSelected ? ' is-selected' : ''}${isDisabled ? ' is-disabled' : ''}`}
                >
                  {opt.badge && <span className="onb-doc-badge">{opt.badge}</span>}
                  <span className="onb-doc-icon" aria-hidden="true">{opt.icon}</span>
                  <span className="onb-doc-label">{opt.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="onb-actions">
          {isPreferenceStep && (
            <button
              type="button"
              onClick={skipPreference}
              className="onb-btn onb-btn--ghost"
            >
              Salta
            </button>
          )}
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance}
            className={`onb-btn onb-btn--primary${canAdvance ? '' : ' is-disabled'}`}
          >
            {isPreferenceStep
              ? preferredDocumentType
                ? `Apri ${documentOptions.find((o) => o.id === preferredDocumentType)?.label}`
                : 'Inizia'
              : 'Continua'}
          </button>
        </div>
      </div>
    </div>
  );
}
