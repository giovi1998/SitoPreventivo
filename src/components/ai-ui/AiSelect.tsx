import React from 'react';

export interface AiSelectOption {
  value: string;
  label: string;
}

export interface AiSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: AiSelectOption[];
  hint?: string;
}

export function AiSelect({ label, options, hint, className = '', ...props }: AiSelectProps) {
  const selectElement = (
      <select className={`ai-select ${className}`} {...props} aria-label={label ? `${label}` : undefined}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
  );

  if (!label) {
    return selectElement;
  }

  return (
    <label className="ai-select-wrapper">
      <span className="ai-select-label">{label}</span>
      {selectElement}
      {hint ? <span className="ai-select-hint">{hint}</span> : null}
    </label>
  );
}
