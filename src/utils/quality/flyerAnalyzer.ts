import type { Flyer } from '../schemas/flyer';
import { computeFlyerLayout } from '../flyer/layoutEngine';
import { finishAnalysis, checkContrast, checkEmptyText, type AnalysisResult } from './sharedAnalyzer';

/** Analyzer deterministico flyer: warning layout (truncation/overflow) + campi vuoti + contrasto. */
export function analyzeFlyer(flyer: Flyer): AnalysisResult {
  const issues: string[] = [];

  checkEmptyText(issues, flyer.content.headline, 'Headline');
  checkEmptyText(issues, flyer.content.body, 'Body');
  checkContrast(issues, flyer.style.textColor, flyer.style.bgColor, 'Testo su sfondo');

  try {
    const plan = computeFlyerLayout(flyer);
    for (const w of plan.warnings) {
      issues.push(w.message);
    }
  } catch {
    issues.push('Layout flyer non calcolabile.');
  }

  return finishAnalysis(issues);
}
