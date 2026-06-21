import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PasswordInput from '../PasswordInput';

describe('PasswordInput', () => {
  beforeEach(() => cleanup());

  it('renders with masked type by default', () => {
    render(<PasswordInput id="pw1" label="Password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('secret');
  });

  it('toggles visibility on button click', () => {
    render(<PasswordInput id="pw2" label="Password" value="secret" onChange={() => {}} />);
    const input = screen.getByLabelText('Password') as HTMLInputElement;
    const toggle = screen.getByLabelText('Mostra password');
    expect(input.type).toBe('password');
    fireEvent.click(toggle);
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByLabelText('Nascondi password'));
    expect(input.type).toBe('password');
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<PasswordInput id="pw3" label="Password" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Password');
    fireEvent.change(input, { target: { value: 'newvalue' } });
    expect(onChange).toHaveBeenCalledWith('newvalue');
  });

  it('applies hasError class', () => {
    const { container } = render(<PasswordInput label="Password" value="x" onChange={() => {}} hasError />);
    expect(container.querySelector('.has-error')).toBeInTheDocument();
  });
});
