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
const EDITOR_SKILLS: Record<string, ProjectSkill[]> = {
  card: [defineSkill('web-design-guidelines', 'Regole UI e accessibilità web (Web Interface Guidelines)')],
  flyer: [defineSkill('gpt-taste', 'Tipografia editoriale larga, struttura AIDA, spaziatura generosa, anti-template')],
  logo: [defineSkill('brandkit', 'Sistemi brand identity premium: concept logo, gerarchia, palette, art direction')],
  social: [defineSkill('muapi-nano-banana', 'Prompt logica-driven per generazione immagini con brief creativi strutturati')],
  website: [defineSkill('high-end-visual-design', 'Design agency-level: font, spacing, ombre, card, animazioni; blocca i default cheap')],
  palette: [defineSkill('minimalist-ui', 'Interfacce editoriali pulite: palette monocrome calde, contrasto tipografico, zero gradienti')],
};

export const SKILL_CATALOG: ProjectSkill[] = Object.values(EDITOR_SKILLS).flat();

function kindFromPromptId(promptId: string): string {
  return promptId.endsWith('-system') ? promptId.slice(0, -'-system'.length) : '';
}

export async function resolveSystemPrompt(promptId: string, ctx?: PromptContext): Promise<string> {
  const base = promptRegistry.getPrompt(promptId, ctx);
  const skills = EDITOR_SKILLS[kindFromPromptId(promptId)];
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
