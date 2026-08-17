import type { Logo } from '../schemas/logo';
import { finishAnalysis, checkContrast, checkEmptyText, type AnalysisResult } from './sharedAnalyzer';

/** Analyzer deterministico logo: testo vuoto, colori, contrasto. */
export function analyzeLogo(logo: Logo): AnalysisResult {
  const issues: string[] = [];

  checkEmptyText(issues, logo.builder.primaryText, 'Testo principale');
  checkContrast(issues, logo.builder.primaryColor, logo.builder.backgroundColor ?? '#ffffff', 'Testo su sfondo');

  if (logo.builder.backgroundImage && (!logo.builder.textBackdrop || logo.builder.textBackdrop === 'none')) {
    issues.push('Logo con immagine di sfondo senza textBackdrop: testo poco leggibile.');
  }

  return finishAnalysis(issues);
}
