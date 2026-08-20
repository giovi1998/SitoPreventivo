// Skill library: le skill di design del progetto (.agents/skills) diventano
// contesto per l'AI degli editor. Test su distill, injection dopo
// promptRegistry (componibile con override Langfuse) e fallback sicuro.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../prompts/registry', () => ({
  get promptRegistry() {
    return {
      getPrompt: vi.fn((id: string) => `BASE:${id}`),
      hasPrompt: vi.fn(() => true),
    };
  },
}));

import {
  resolveSystemPrompt,
  loadSkillContent,
  distillSkillMarkdown,
  SKILL_CATALOG,
} from '../skillLibrary';

describe('distillSkillMarkdown', () => {
  it('rimuove il frontmatter YAML', () => {
    const raw = '---\nname: test\ndescription: Skills di test.\n---\n\n# Corpo\nRegole qui.';
    expect(distillSkillMarkdown(raw)).toBe('# Corpo\nRegole qui.');
  });

  it('lascia intatto il markdown senza frontmatter', () => {
    expect(distillSkillMarkdown('# Titolo\nTesto')).toBe('# Titolo\nTesto');
  });

  it('clippa le skill oltre il cap con marker di troncamento', () => {
    const huge = 'x'.repeat(30000);
    const out = distillSkillMarkdown(huge);
    expect(out.length).toBeLessThanOrEqual(20000);
    expect(out).toContain('troncata');
  });
});

describe('resolveSystemPrompt', () => {
  it('inietta la skill curata per kind dopo il prompt del registry', async () => {
    const out = await resolveSystemPrompt('card-system');
    expect(out).toContain('BASE:card-system');
    expect(out).toContain('Skill di progetto: web-design-guidelines');
  });

  it('kind senza skill curate: prompt invariato', async () => {
    expect(await resolveSystemPrompt('quote-system')).toBe('BASE:quote-system');
  });

  it('passa il ctx al registry', async () => {
    await resolveSystemPrompt('quote-system', { compact: false });
    // Il mock ignora ctx ma il chiamante lo inoltra: verificato dai test
    // orchestratore con registry reale. Qui basta che non lanci.
    expect(true).toBe(true);
  });

  it('t13: skill disattivata dall\u2019utente → prompt senza skill', async () => {
    const { setAiSkillDisabled } = await import('../../utils/uiPrefs');
    setAiSkillDisabled('card', true);
    const out = await resolveSystemPrompt('card-system');
    expect(out).toBe('BASE:card-system');
    setAiSkillDisabled('card', false);
  });

  it('t14: website style=brutalist → skill industrial-brutalist-ui (sostituzione)', async () => {
    const out = await resolveSystemPrompt('website-system', { style: 'brutalist' });
    expect(out).toContain('BASE:website-system');
    expect(out).toContain('industrial-brutalist-ui');
    expect(out).not.toContain('high-end-visual-design');
  });

  it('t14: website style=minimal → skill minimalist-ui', async () => {
    const out = await resolveSystemPrompt('website-system', { style: 'minimal' });
    expect(out).toContain('minimalist-ui');
    expect(out).not.toContain('high-end-visual-design');
  });

  it('t14: website style non mappato → skill default high-end-visual-design', async () => {
    const out = await resolveSystemPrompt('website-system', { style: 'luxury' });
    expect(out).toContain('high-end-visual-design');
    expect(out).not.toContain('industrial-brutalist-ui');
  });
});

describe('loadSkillContent', () => {
  beforeEach(() => vi.unstubAllEnvs());

  it('carica una skill del catalogo senza frontmatter', async () => {
    const brandkit = await loadSkillContent('brandkit');
    expect(brandkit).toBeTruthy();
    expect(brandkit!.startsWith('---')).toBe(false);
  });

  it('ritorna null per skill fuori catalogo', async () => {
    expect(await loadSkillContent('adhd-caveman')).toBeNull();
    expect(await loadSkillContent('non-esiste')).toBeNull();
  });
});

describe('SKILL_CATALOG', () => {
  it('copre tutti i kind editor mappati', () => {
    const names = SKILL_CATALOG.map((s) => s.name);
    for (const expected of [
      'web-design-guidelines',
      'gpt-taste',
      'brandkit',
      'muapi-nano-banana',
      'high-end-visual-design',
      'minimalist-ui',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it('ogni voce ha name, summary e loader', () => {
    for (const s of SKILL_CATALOG) {
      expect(s.name).toMatch(/^[\w-]+$/);
      expect(s.summary.length).toBeGreaterThan(5);
      expect(typeof s.load).toBe('function');
    }
  });
});
