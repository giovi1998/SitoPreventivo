import React from 'react';

export interface AiSelectOption {
  value: string;
  label: string;
}

export interface AiSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: AiSelectOption[];
}

export function AiSelect({ label, options, className = '', ...props }: AiSelectProps) {
  const selectElement = (
    <select className={`ai-select ${className}`} {...props}>
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
    </label>
  );
}
