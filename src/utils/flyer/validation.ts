import type { FlyerLayoutPlan, FlyerDensity } from './geometry';

export function validateLayoutPlan(plan: FlyerLayoutPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (plan.density === 'overflow') {
    errors.push('Layout overflow: content exceeds available space.');
  }
  if (plan.warnings.some((w) => w.severity === 'error')) {
    errors.push('Layout contains errors.');
  }
  return { valid: errors.length === 0, errors };
}

export function isDensitySafe(density: FlyerDensity): boolean {
  return density !== 'overflow';
}
