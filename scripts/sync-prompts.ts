// TB-029 fase 2: sync dei prompt dal codice verso Langfuse
// (Prompt Management). Upload come nuova versione con label + tags.
//
// Uso:
//   LANGFUSE_PUBLIC_KEY=... LANGFUSE_SECRET_KEY=... LANGFUSE_BASE_URL=... \
//     npx tsx scripts/sync-prompts.ts [--label production] [--dry-run]
//
// Label: production per Vercel, staging per lo sviluppo locale
// (template diversi per ambiente: il client chiede label in base
// all'hostname). Il codice locale resta la fonte di verità per il
// fallback se Langfuse non è raggiungibile.
//
// Tags: ogni prompt riceve `environment:<label>` (production/staging —
// all'inizio identici tra ambienti, possono divergere) + `quickbrand`
// (dominio). I tags si filtrano in Langfuse (Prompt Management).
//
// TB-032: --message "descrizione" → commitMessage sulla versione caricata
// (le versioni senza descrizione sono indistinguibili nei test A/B).
import { buildCardSystemPrompt } from '../src/ai/prompts/cardSystem';
import { buildSystemPrompt } from '../src/ai/prompts/system';
import { buildFlyerSystemPrompt } from '../src/ai/prompts/flyerSystem';
import { buildLogoSystemPrompt } from '../src/ai/prompts/logoSystem';
import { buildSocialSystemPrompt } from '../src/ai/prompts/socialSystem';
import { buildOnboardingSystemPrompt } from '../src/ai/prompts/onboardingSystem';
import { buildWebsiteSystemPrompt } from '../src/ai/prompts/websiteSystem';
import { buildPaletteSystemPrompt } from '../src/ai/prompts/paletteSystem';

const PROMPTS = [
  { name: 'card-system', type: 'chat', prompt: [{ role: 'system', content: buildCardSystemPrompt() }] },
  { name: 'quote-system', type: 'chat', prompt: [{ role: 'system', content: buildSystemPrompt(true) }] },
  { name: 'flyer-system', type: 'chat', prompt: [{ role: 'system', content: buildFlyerSystemPrompt() }] },
  { name: 'logo-system', type: 'chat', prompt: [{ role: 'system', content: buildLogoSystemPrompt() }] },
  { name: 'social-system', type: 'chat', prompt: [{ role: 'system', content: buildSocialSystemPrompt() }] },
  { name: 'onboarding-system', type: 'chat', prompt: [{ role: 'system', content: buildOnboardingSystemPrompt() }] },
  { name: 'website-system', type: 'chat', prompt: [{ role: 'system', content: buildWebsiteSystemPrompt() }] },
  { name: 'palette-system', type: 'chat', prompt: [{ role: 'system', content: buildPaletteSystemPrompt() }] },
];

// Tags per ambiente: `environment:<label>` (identici all'inizio tra
// staging e production — poi possono divergere, es. `a-b:experiment-v2`).
function tagsForLabel(label: string): string[] {
  return ['quickbrand', `environment:${label}`];
}

const args = process.argv.slice(2);
const labelIdx = args.indexOf('--label');
const labelArg = (labelIdx !== -1 && args[labelIdx + 1] && !args[labelIdx + 1].startsWith('--'))
  ? args[labelIdx + 1]
  : args.find((a) => a.startsWith('--label='))?.split('=')[1] ?? 'production';
const dryRun = args.includes('--dry-run');
const msgIdx = args.indexOf('--message');
const commitMessage = (msgIdx !== -1 && args[msgIdx + 1] && !args[msgIdx + 1].startsWith('--'))
  ? args[msgIdx + 1]
  : args.find((a) => a.startsWith('--message='))?.split('=').slice(1).join('=') ?? undefined;

const pk = process.env.LANGFUSE_PUBLIC_KEY || process.env.VITE_LANGFUSE_PUBLIC_KEY;
const sk = process.env.LANGFUSE_SECRET_KEY || process.env.VITE_LANGFUSE_SECRET_KEY;
const base = process.env.LANGFUSE_BASE_URL || process.env.VITE_LANGFUSE_BASE_URL;

if (!dryRun && (!pk || !sk || !base)) {
  console.error('Mancano LANGFUSE_PUBLIC_KEY/SECRET_KEY/BASE_URL (o VITE_*)');
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${pk}:${sk}`).toString('base64')}`;

async function main() {
  for (const p of PROMPTS) {
    if (dryRun) {
      console.log(`[dry-run] ${p.name} (${p.type}, ${p.prompt[0].content.length} chars) → label ${labelArg}, tags [${tagsForLabel(labelArg).join(', ')}]${commitMessage ? `, message "${commitMessage}"` : ''}`);
      continue;
    }
    const res = await fetch(`${base}/api/public/v2/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify({
        name: p.name,
        type: p.type,
        prompt: p.prompt,
        labels: [labelArg],
        tags: tagsForLabel(labelArg),
        ...(commitMessage ? { commitMessage } : {}),
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[fail] ${p.name}: ${res.status} ${text.slice(0, 200)}`);
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { version?: number };
    console.log(`[ok] ${p.name} → v${body.version ?? '?'} (label ${labelArg}, tags [${tagsForLabel(labelArg).join(', ')}])`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
