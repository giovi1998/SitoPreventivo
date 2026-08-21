// Skill library: le skill di design del progetto (.agents/skills) diventano
// richiamabili dall'AI degli editor, con due meccanismi:
// 1. resolveSystemPrompt — arricchisce il system prompt risolto dal
//    promptRegistry con le skill curate per quel kind. L'injection avviene
//    DOPO la risoluzione così compone con gli override remoti Langfuse
//    (che rimpiazzano i builder del registry, non questo wrapper).
// 2. loadSkillContent + SKILL_CATALOG — catalogo per il tool load_skill
//    dell'agent harness (richiamo on-demand da parte del modello).
// I contenuti sono import `?raw` dinamici con path letterali (chunk
// on-demand, gotcha §25); .agents è committato quindi i file esistono
// anche nella build Vercel. Ogni load fallita degrada in silenzio: mai
// rompere il flusso AI per una skill mancante.
import { promptRegistry } from './prompts/registry';
import type { PromptContext } from './prompts/registry';
import { isAiSkillDisabled } from '../utils/uiPrefs';

const MAX_SKILL_CHARS = 20000;

export function distillSkillMarkdown(raw: string): string {
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  if (body.length <= MAX_SKILL_CHARS) return body;
  const marker = `\n\n[…skill troncata a ${MAX_SKILL_CHARS} caratteri…]`;
  return body.slice(0, MAX_SKILL_CHARS - marker.length) + marker;
}

export interface ProjectSkill {
  name: string;
  summary: string;
  load: () => Promise<string>;
}

// Loader lazy con distill memoizzato: path letterali per l'analisi statica
// di Vite/Rollup (import dinamici non analizzabili rompono la build).
const RAW_LOADERS: Record<string, () => Promise<string>> = {
  'web-design-guidelines': async () => (await import('../../.agents/skills/web-design-guidelines/SKILL.md?raw')).default,
  'gpt-taste': async () => (await import('../../.agents/skills/gpt-taste/SKILL.md?raw')).default,
  brandkit: async () => (await import('../../.agents/skills/brandkit/SKILL.md?raw')).default,
  'muapi-nano-banana': async () => (await import('../../.agents/skills/muapi-nano-banana/SKILL.md?raw')).default,
  'high-end-visual-design': async () => (await import('../../.agents/skills/high-end-visual-design/SKILL.md?raw')).default,
  'minimalist-ui': async () => (await import('../../.agents/skills/minimalist-ui/SKILL.md?raw')).default,
  'industrial-brutalist-ui': async () => (await import('../../.agents/skills/industrial-brutalist-ui/SKILL.md?raw')).default,
};

const defineSkill = (name: string, summary: string): ProjectSkill => {
  let cached: string | null = null;
  return {
    name,
    summary,
    load: async () => {
      if (cached === null) cached = distillSkillMarkdown(await RAW_LOADERS[name]());
      return cached;
    },
  };
};

// Kind editor → skill curate. Quote/onboarding: nessuna skill pertinente
// nel progetto (i prompt sono già mirati); l'agente usa load_skill.
export const EDITOR_SKILLS: Record<string, ProjectSkill[]> = {
  card: [defineSkill('web-design-guidelines', 'Regole UI e accessibilità web (Web Interface Guidelines)')],
  flyer: [defineSkill('gpt-taste', 'Tipografia editoriale larga, struttura AIDA, spaziatura generosa, anti-template')],
  logo: [defineSkill('brandkit', 'Sistemi brand identity premium: concept logo, gerarchia, palette, art direction')],
  social: [defineSkill('muapi-nano-banana', 'Prompt logica-driven per generazione immagini con brief creativi strutturati')],
  // t14: il default website usa high-end-visual-design; gli stili
  // specifici (minimal/brutalist/editorial...) usano la skill dedicata
  // via STYLE_SKILL_MAP (sostituzione, non somma → token invariati).
  website: [defineSkill('high-end-visual-design', 'Design agency-level: font, spacing, ombre, card, animazioni; blocca i default cheap')],
  palette: [defineSkill('minimalist-ui', 'Interfacce editoriali pulite: palette monocrome calde, contrasto tipografico, zero gradienti')],
};

/** t14: website style → skill dedicata. Sostituisce la skill fissa del kind. */
const STYLE_SKILL_MAP: Record<string, string> = {
  minimal: 'minimalist-ui',
  minimalist: 'minimalist-ui',
  brutalist: 'industrial-brutalist-ui',
  editorial: 'gpt-taste',
};

// t14: skill extra per la mappa style→skill (non iniettate di default).
const STYLE_SKILLS: ProjectSkill[] = [
  defineSkill('industrial-brutalist-ui', 'Interfacce meccaniche raw: griglie rigide, scala tipografica estrema, utilitarismo')];

export const SKILL_CATALOG: ProjectSkill[] = [...Object.values(EDITOR_SKILLS).flat(), ...STYLE_SKILLS];

/** Kind editor che hanno una skill di progetto (per il toggle t13). */
export const EDITOR_SKILL_KINDS: string[] = Object.keys(EDITOR_SKILLS);

/** t13: la skill curata per il kind editor è attiva? (toggle utente in pq_ui:v1). */
export function editorSkillsEnabled(kind: string): boolean {
  return !isAiSkillDisabled(kind as never);
}

function kindFromPromptId(promptId: string): string {
  return promptId.endsWith('-system') ? promptId.slice(0, -'-system'.length) : '';
}

export async function resolveSystemPrompt(promptId: string, ctx?: PromptContext): Promise<string> {
  const base = promptRegistry.getPrompt(promptId, ctx);
  const kind = kindFromPromptId(promptId);
  // t13: toggle utente — la skill del kind può essere esclusa dalla prossima call.
  if (!kind || !editorSkillsEnabled(kind)) return base;
  let skills = EDITOR_SKILLS[kind];
  // t14: website style → skill dedicata (es. brutalist → industrial-brutalist-ui).
  if (kind === 'website' && ctx?.style) {
    const styleSkill = STYLE_SKILL_MAP[String(ctx.style).toLowerCase()];
    if (styleSkill) {
      const entry = SKILL_CATALOG.find((s) => s.name === styleSkill);
      if (entry) skills = [entry];
    }
  }
  if (!skills?.length) return base;
  const blocks = await Promise.all(
    skills.map((s) =>
      s
        .load()
        .then((content) => `# Skill di progetto: ${s.name}\n${content}`)
        .catch(() => {
          console.warn(`[skillLibrary] load fallita: ${s.name}`);
          return null;
        }),
    ),
  );
  const valid = blocks.filter((b): b is string => b !== null);
  return valid.length ? `${base}\n\n${valid.join('\n\n')}` : base;
}

export async function loadSkillContent(name: string): Promise<string | null> {
  const s = SKILL_CATALOG.find((entry) => entry.name === name);
  if (!s) return null;
  try {
    return await s.load();
  } catch {
    console.warn(`[skillLibrary] load fallita: ${name}`);
    return null;
  }
}
