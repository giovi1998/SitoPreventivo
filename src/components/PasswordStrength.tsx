import React from 'react';

export interface PasswordRules {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export const EMPTY_RULES: PasswordRules = {
  minLength: false,
  hasUpper: false,
  hasLower: false,
  hasNumber: false,
  hasSpecial: false,
};

export function evaluatePassword(pw: string): PasswordRules {
  return {
    minLength: pw.length >= 12,
    hasUpper: /[A-Z]/.test(pw),
    hasLower: /[a-z]/.test(pw),
    hasNumber: /[0-9]/.test(pw),
    hasSpecial: /[^A-Za-z0-9]/.test(pw),
  };
}

export function scorePassword(rules: PasswordRules, length: number): { score: number; label: string; tone: 'weak' | 'fair' | 'good' | 'strong' } {
  const passed = Object.values(rules).filter(Boolean).length;
  if (!length) return { score: 0, label: '—', tone: 'weak' };
  if (passed <= 2) return { score: 25, label: 'Debole', tone: 'weak' };
  if (passed === 3) return { score: 50, label: 'Discreta', tone: 'fair' };
  if (passed === 4) return { score: 75, label: 'Buona', tone: 'good' };
  if (passed === 5 && length >= 14) return { score: 100, label: 'Molto forte', tone: 'strong' };
  return { score: 90, label: 'Forte', tone: 'strong' };
}

interface PasswordStrengthProps {
  rules: PasswordRules;
  password: string;
}

const RULE_LIST: Array<{ key: keyof PasswordRules; label: string }> = [
  { key: 'minLength', label: 'Almeno 12 caratteri' },
  { key: 'hasUpper', label: 'Una lettera maiuscola' },
  { key: 'hasLower', label: 'Una lettera minuscola' },
  { key: 'hasNumber', label: 'Un numero' },
  { key: 'hasSpecial', label: 'Un carattere speciale' },
];

export default function PasswordStrength({ rules, password }: PasswordStrengthProps) {
  const { score, label, tone } = scorePassword(rules, password.length);

  if (!password) {
    return (
      <div className="pw-strength" aria-live="polite">
        <div className="pw-strength-bar" data-tone="empty">
          <div className="pw-strength-fill" style={{ width: '0%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="pw-strength" aria-live="polite">
      <div className="pw-strength-header">
        <span className="pw-strength-label">Forza password:</span>
        <span className={`pw-strength-value pw-tone-${tone}`}>{label}</span>
      </div>
      <div className="pw-strength-bar" data-tone={tone} role="progressbar" aria-valuenow={score} aria-valuemin={0} aria-valuemax={100}>
        <div className="pw-strength-fill" style={{ width: `${score}%` }} />
      </div>
      <ul className="pw-rules">
        {RULE_LIST.map(({ key, label: ruleLabel }) => (
          <li key={key} className={rules[key] ? 'passed' : ''}>
            <span className="pw-rule-icon" aria-hidden="true">
              {rules[key] ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /></svg>
              )}
            </span>
            {ruleLabel}
          </li>
        ))}
      </ul>
    </div>
  );
}
