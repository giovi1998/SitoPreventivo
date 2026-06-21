import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PasswordStrength, { EMPTY_RULES, evaluatePassword } from '../PasswordStrength';

describe('PasswordStrength', () => {
  beforeEach(() => cleanup());

  it('renders nothing visible when password is empty', () => {
    const { container } = render(<PasswordStrength rules={EMPTY_RULES} password="" />);
    expect(container.querySelector('[data-tone="empty"]')).toBeInTheDocument();
  });

  it('shows weak label for short password', () => {
    const rules = evaluatePassword('abc');
    render(<PasswordStrength rules={rules} password="abc" />);
    expect(screen.getByText('Debole')).toBeInTheDocument();
  });

  it('shows very strong for all rules + 14+ chars', () => {
    const rules = evaluatePassword('VeryStrong1234!@#');
    render(<PasswordStrength rules={rules} password="VeryStrong1234!@#" />);
    expect(screen.getByText('Molto forte')).toBeInTheDocument();
  });

  it('marks passed rules with passed class', () => {
    const rules = evaluatePassword('Abcdefghijkl1!');
    const { container } = render(<PasswordStrength rules={rules} password="Abcdefghijkl1!" />);
    const passed = container.querySelectorAll('.pw-rules li.passed');
    expect(passed.length).toBeGreaterThan(0);
  });
});
