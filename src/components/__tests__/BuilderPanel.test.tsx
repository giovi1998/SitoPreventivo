import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import BuilderPanel from '../BuilderPanel';
import { createEmptyLogo, createLogoTemplate } from '../../utils/documentSchemas';
import type { Logo } from '../../utils/documentSchemas';

vi.mock('lucide-react', () => {
  const makeIcon = (name: string) => (props: any) => (
    <svg data-testid={`icon-${name}`} data-iconname={name} {...props} />
  );
  const ICON_NAMES = [
    'Coffee', 'Utensils', 'Wine', 'Pizza', 'Cake',
    'ChefHat', 'Drumstick', 'IceCreamCone', 'Apple', 'Sandwich',
    'Code', 'Cpu', 'Database', 'Cloud', 'Terminal',
    'Server', 'Smartphone', 'Wifi', 'Zap', 'Layers',
    'Shirt', 'Scissors', 'Sparkles', 'Gem', 'Crown',
    'Watch', 'ShoppingBag', 'Palette', 'Frame',
    'Briefcase', 'Building', 'Scale', 'Stethoscope', 'BookOpen',
    'GraduationCap', 'Hammer', 'Wrench', 'Lightbulb', 'Globe',
    'Leaf', 'TreePine', 'Flower', 'Mountain', 'Sun',
    'Moon', 'Star', 'Flame', 'Waves',
  ];
  const mock: Record<string, any> = { Search: makeIcon('search') };
  for (const n of ICON_NAMES) {
    const lower = n.replace(/[A-Z]/g, (m, i) => (i === 0 ? m.toLowerCase() : `-${m.toLowerCase()}`));
    mock[n] = makeIcon(lower);
  }
  return mock;
});

describe('BuilderPanel', () => {
  let logo: Logo;
  const onPatch = vi.fn();

  beforeEach(() => {
    logo = createEmptyLogo();
    onPatch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders all 9 form fields (AC-002, REQ-002)', () => {
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    expect(screen.getByLabelText(/Testo principale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sottotitolo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tipo icona/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore principale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore secondario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Font/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Layout/i)).toBeInTheDocument();
  });

  it('does NOT show iconGlyph/iconShape fields when iconType=none (REQ-004)', () => {
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    expect(screen.queryByLabelText(/Glifo icona/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Forma icona/i)).not.toBeInTheDocument();
  });

  it('shows iconShape field when iconType=shape', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'shape', iconShape: 'square' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    expect(screen.getByLabelText(/Forma icona/i)).toBeInTheDocument();
  });

  it('shows iconGlyph field (monogram text input) when iconType=monogram (AC-006)', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'monogram', iconGlyph: 'AC' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    expect(screen.getByLabelText(/Lettere monogramma/i)).toBeInTheDocument();
  });

  it('auto-uppercases monogram input (AC-006)', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'monogram' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    const input = screen.getByLabelText(/Lettere monogramma/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ac' } });
    expect(onPatch).toHaveBeenCalledWith('builder.iconGlyph', 'AC');
  });

  it('shows 48-icon grid with search box when iconType=lucide (AC-004)', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'lucide' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    expect(screen.getByLabelText(/Cerca icona/i)).toBeInTheDocument();
    // 48 icone renderizzate
    const buttons = screen.getAllByRole('option', { name: /Scegli icona /i });
    expect(buttons.length).toBe(48);
  });

  it('filters icons via search box', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'lucide' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    const search = screen.getByLabelText(/Cerca icona/i);
    fireEvent.change(search, { target: { value: 'coffee' } });
    const buttons = screen.getAllByRole('option', { name: /Scegli icona /i });
    expect(buttons.length).toBe(1);
    expect(within(buttons[0]).getByTestId('icon-coffee')).toBeInTheDocument();
  });

  it('clicking a lucide icon populates iconGlyph (AC-005)', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, iconType: 'lucide' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    const buttons = screen.getAllByRole('option', { name: /Scegli icona /i });
    fireEvent.click(buttons[0]); // primo = 'coffee'
    expect(onPatch).toHaveBeenCalledWith('builder.iconGlyph', 'coffee');
  });

  it('shows 4 sector template buttons (AC-002)', () => {
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    expect(screen.getByRole('button', { name: /^Tech$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Food$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fashion$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Professionista$/i })).toBeInTheDocument();
  });

  it('renders a live SVG preview (debounce 200ms)', () => {
    vi.useFakeTimers();
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    vi.advanceTimersByTime(250);
    const preview = screen.getByLabelText(/Anteprima logo SVG/i);
    expect(preview.querySelector('svg')).toBeInTheDocument();
  });

  it('updates the preview when primaryText changes (AC-003, AC-007)', async () => {
    vi.useFakeTimers();
    const { rerender } = render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    act(() => { vi.advanceTimersByTime(250); });
    const l2: Logo = { ...logo, builder: { ...logo.builder, primaryText: 'Acme' } };
    rerender(<BuilderPanel logo={l2} onPatch={onPatch} />);
    act(() => { vi.advanceTimersByTime(250); });
    const preview = screen.getByLabelText(/Anteprima logo SVG/i);
    expect(preview.innerHTML).toContain('Acme');
  });

  it('layout switcher reflects current layout', () => {
    const l: Logo = { ...logo, builder: { ...logo.builder, layout: 'stacked' } };
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    const select = screen.getByLabelText(/Layout/i) as HTMLSelectElement;
    expect(select.value).toBe('stacked');
  });

  it('changing layout calls onPatch with builder.layout', () => {
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    const select = screen.getByLabelText(/Layout/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'vertical' } });
    expect(onPatch).toHaveBeenCalledWith('builder.layout', 'vertical');
  });

  it('escapes XML in primaryText input (XSS prevention)', () => {
    render(<BuilderPanel logo={logo} onPatch={onPatch} />);
    const input = screen.getByLabelText(/Testo principale/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '<script>alert(1)</script>' } });
    expect(onPatch).toHaveBeenCalledWith('builder.primaryText', '<script>alert(1)</script>');
    // La escaping vera avviene in builderToSvg (test in logoGenerator.test.ts)
  });

  it('sector template click triggers onTemplate (AC-002)', () => {
    const onTemplate = vi.fn();
    render(<BuilderPanel logo={logo} onPatch={onPatch} onTemplate={onTemplate} />);
    fireEvent.click(screen.getByRole('button', { name: /^Tech$/i }));
    expect(onTemplate).toHaveBeenCalledWith('tech');
  });

  it('pre-fills from createLogoTemplate when initial logo has tech sector', () => {
    const l = createLogoTemplate('tech');
    render(<BuilderPanel logo={l} onPatch={onPatch} />);
    const input = screen.getByLabelText(/Testo principale/i) as HTMLInputElement;
    expect(input.value).toBe('CodeLab');
  });
});
