import type { DocumentTemplateId } from './quoteSchema';

export interface DocumentTheme {
  id: DocumentTemplateId;
  label: string;
  description: string;
  fontFamily: string;
  fontFamilyDisplay: string;
  fontSize: {
    title: string;
    subtitle: string;
    body: string;
    small: string;
  };
  spacing: {
    section: string;
    paragraph: string;
    table: string;
  };
  layout: 'card' | 'table' | 'list';
  headerStyle: 'structured' | 'minimal' | 'gradient';
  footerStyle: 'legal' | 'simple' | 'branded';
  tableHeaderBg: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    headerBg: string;
    headerText: string;
  };
  borderRadius: string;
  shadow: string;
}

export const themes: Record<DocumentTemplateId, DocumentTheme> = {
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Spazi bianchi ampi, tipografia sans-serif, tabelle senza bordi',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontFamilyDisplay: "'Inter', system-ui, sans-serif",
    fontSize: { title: '24px', subtitle: '16px', body: '12px', small: '10px' },
    spacing: { section: '32px', paragraph: '16px', table: '12px' },
    layout: 'list',
    headerStyle: 'minimal',
    footerStyle: 'simple',
    tableHeaderBg: 'transparent',
    colors: {
      primary: '#1a1a2e',
      secondary: '#16213e',
      accent: '#01696F',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a1a2e',
      textMuted: '#6b7280',
      border: '#e5e7eb',
      headerBg: '#ffffff',
      headerText: '#1a1a2e',
    },
    borderRadius: '0',
    shadow: 'none',
  },
  corporate: {
    id: 'corporate',
    label: 'Corporate',
    description: 'Header strutturato con logo, tabelle formali, footer con dati legali',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontFamilyDisplay: "'Inter', system-ui, sans-serif",
    fontSize: { title: '26px', subtitle: '18px', body: '11px', small: '9px' },
    spacing: { section: '28px', paragraph: '14px', table: '10px' },
    layout: 'table',
    headerStyle: 'structured',
    footerStyle: 'legal',
    tableHeaderBg: '#1a1a2e',
    colors: {
      primary: '#1a1a2e',
      secondary: '#3a3a5e',
      accent: '#01696F',
      background: '#ffffff',
      surface: '#f4f5f7',
      text: '#1a1a2e',
      textMuted: '#6b7280',
      border: '#d1d5db',
      headerBg: '#1a1a2e',
      headerText: '#ffffff',
    },
    borderRadius: '4px',
    shadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  creative: {
    id: 'creative',
    label: 'Creative',
    description: 'Header con gradiente, card colorate per le opzioni, icone decorative',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontFamilyDisplay: "'Source Serif 4', Georgia, serif",
    fontSize: { title: '28px', subtitle: '20px', body: '12px', small: '10px' },
    spacing: { section: '36px', paragraph: '18px', table: '14px' },
    layout: 'card',
    headerStyle: 'gradient',
    footerStyle: 'branded',
    tableHeaderBg: '#01696F',
    colors: {
      primary: '#01696F',
      secondary: '#0d9488',
      accent: '#f59e0b',
      background: '#fafafa',
      surface: '#ffffff',
      text: '#1a1a2e',
      textMuted: '#6b7280',
      border: '#e5e7eb',
      headerBg: 'linear-gradient(135deg, #01696F 0%, #0d9488 100%)',
      headerText: '#ffffff',
    },
    borderRadius: '12px',
    shadow: '0 4px 16px rgba(1,105,111,0.1)',
  },
};

export function getTheme(id: DocumentTemplateId): DocumentTheme {
  return themes[id] || themes.corporate;
}

export function getThemeStyles(id: DocumentTemplateId): Record<string, string> {
  const t = getTheme(id);
  return {
    '--doc-font-family': t.fontFamily,
    '--doc-font-family-display': t.fontFamilyDisplay,
    '--doc-font-size-title': t.fontSize.title,
    '--doc-font-size-subtitle': t.fontSize.subtitle,
    '--doc-font-size-body': t.fontSize.body,
    '--doc-font-size-small': t.fontSize.small,
    '--doc-spacing-section': t.spacing.section,
    '--doc-spacing-paragraph': t.spacing.paragraph,
    '--doc-spacing-table': t.spacing.table,
    '--doc-color-primary': t.colors.primary,
    '--doc-color-secondary': t.colors.secondary,
    '--doc-color-accent': t.colors.accent,
    '--doc-color-background': t.colors.background,
    '--doc-color-surface': t.colors.surface,
    '--doc-color-text': t.colors.text,
    '--doc-color-text-muted': t.colors.textMuted,
    '--doc-color-border': t.colors.border,
    '--doc-color-header-bg': t.colors.headerBg,
    '--doc-color-header-text': t.colors.headerText,
    '--doc-border-radius': t.borderRadius,
    '--doc-shadow': t.shadow,
  };
}

export function getPdfMakeStyle(themeId: DocumentTemplateId) {
  const t = getTheme(themeId);
  return {
    font: themeId === 'creative' ? undefined : 'Roboto',
    colors: {
      primary: t.colors.primary,
      secondary: t.colors.secondary,
      accent: t.colors.accent,
      text: t.colors.text,
      muted: t.colors.textMuted,
      border: t.colors.border,
      headerBg: t.colors.primary,
      headerText: t.colors.headerText,
      surface: t.colors.surface,
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: themeId === 'minimal' ? 10 : 9,
      color: t.colors.text,
    },
  };
}
