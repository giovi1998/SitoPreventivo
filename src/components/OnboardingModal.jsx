import React, { useState } from 'react';

const BRAND_COLORS = ["#0B57D0","#11845B","#6D3FD1","#A66200","#D64545","#B83280","#0F766E","#334155","#4F46E5","#5B7F22"];
const VAT_OPTIONS = [
  { value: 22, label: '22%' },
  { value: 10, label: '10%' },
  { value: 4, label: '4%' },
  { value: 0, label: '0%' },
];

const STEPS = [
  { title: 'Benvenuto!', subtitle: 'Come ti chiami?' },
  { title: 'Il tuo business', subtitle: 'Nome della tua azienda/studio?' },
  { title: 'Colore brand', subtitle: 'Scegli il colore predefinito' },
  { title: 'IVA predefinita', subtitle: 'Quale aliquota usi di solito?' },
];

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [defaultColor, setDefaultColor] = useState('#0B57D0');
  const [defaultVat, setDefaultVat] = useState(22);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete({ displayName, companyName, defaultColor, defaultVat, onboardingDone: true });
  };

  const canAdvance = step === 0 ? displayName.trim().length > 0 : true;

  return (
    <div className="onb-overlay">
      <div className="onb-dialog" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: '32px', height: '4px', borderRadius: '2px',
                background: i <= step ? 'var(--accent)' : 'var(--line)',
                transition: 'background .2s',
              }} />
            ))}
          </div>
          <span style={{ fontSize: '.75rem', color: 'var(--muted)', fontWeight: 600 }}>{step + 1}/{STEPS.length}</span>
        </div>

        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem', fontWeight: 900, color: 'var(--ink)' }}>{STEPS[step].title}</h2>
        <p style={{ margin: '0 0 24px', fontSize: '.9rem', color: 'var(--muted)' }}>{STEPS[step].subtitle}</p>

        {step === 0 && (
          <input
            type="text" autoFocus value={displayName} onChange={e => setDisplayName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canAdvance && next()}
            placeholder="Es. Marco" style={{ marginBottom: '24px' }}
          />
        )}
        {step === 1 && (
          <input
            type="text" autoFocus value={companyName} onChange={e => setCompanyName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && next()}
            placeholder="Es. Studio Rossi Design" style={{ marginBottom: '24px' }}
          />
        )}
        {step === 2 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {BRAND_COLORS.map(c => (
              <button key={c} onClick={() => setDefaultColor(c)} style={{
                width: '100%', aspectRatio: '1', borderRadius: '12px', border: defaultColor === c ? '3px solid var(--ink)' : '2px solid transparent',
                background: c, cursor: 'pointer', transition: 'transform .15s, border-color .15s',
                boxShadow: defaultColor === c ? '0 4px 12px rgba(0,0,0,.2)' : 'none',
                transform: defaultColor === c ? 'scale(1.1)' : 'scale(1)',
              }} />
            ))}
          </div>
        )}
        {step === 3 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '24px' }}>
            {VAT_OPTIONS.map(v => (
              <button key={v.value} onClick={() => setDefaultVat(v.value)} style={{
                padding: '14px 8px', borderRadius: '12px', fontWeight: 800, fontSize: '.95rem',
                border: defaultVat === v.value ? '2px solid var(--accent)' : '2px solid var(--line)',
                background: defaultVat === v.value ? 'var(--blue-bg)' : 'var(--surface)',
                color: defaultVat === v.value ? 'var(--accent)' : 'var(--ink)',
                cursor: 'pointer', transition: 'all .15s',
              }}>{v.label}</button>
            ))}
          </div>
        )}

        <button onClick={next} disabled={!canAdvance} style={{
          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
          background: canAdvance ? 'var(--accent)' : 'var(--line)', color: '#fff',
          fontWeight: 800, fontSize: '.95rem', cursor: canAdvance ? 'pointer' : 'not-allowed',
          boxShadow: canAdvance ? '0 4px 16px rgba(11,87,208,.3)' : 'none',
          transition: 'all .15s',
        }}>
          {step === STEPS.length - 1 ? 'Inizia' : 'Continua'}
        </button>
      </div>
    </div>
  );
}
