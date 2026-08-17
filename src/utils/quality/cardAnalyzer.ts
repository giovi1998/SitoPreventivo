import type { BusinessCard } from '../schemas/card';
import { collides, type GridRect } from '../gridUtils';
import { finishAnalysis, checkContrast, checkEmptyText, type AnalysisResult } from './sharedAnalyzer';

/** Analyzer deterministico card: collisioni grid, campi vuoti, contrasto. */
export function analyzeCard(card: BusinessCard): AnalysisResult {
  const issues: string[] = [];

  checkEmptyText(issues, card.front.name, 'Nome');
  checkEmptyText(issues, card.front.title, 'Titolo');
  checkEmptyText(issues, card.front.company, 'Azienda');
  checkContrast(issues, card.style.textColor, card.style.bgColor, 'Testo su sfondo');

  const grid = (card.grid?.elements ?? {}) as Record<string, GridRect>;
  const backGrid = (card.backGrid?.elements ?? {}) as Record<string, GridRect>;
  // Confronto PER LATO: front e back sono lati diversi, gli elementi non
  // possono collidere tra lati (falso positivo se fusi in un unico set).
  checkCollisions(issues, grid, 'front');
  checkCollisions(issues, backGrid, 'back');

  return finishAnalysis(issues);
}

function checkCollisions(issues: string[], elements: Record<string, GridRect>, side: string): void {
  const keys = Object.keys(elements);
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = elements[keys[i]];
      const b = elements[keys[j]];
      if (a && b && collides(a, b)) {
        issues.push(`Elementi grid sovrapposti (${side}): ${keys[i]} e ${keys[j]}.`);
      }
    }
  }
}
