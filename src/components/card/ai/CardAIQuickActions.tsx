import React from 'react';
import { AiSection, AiActionChip, AiActionGrid } from '../../ai-ui';

interface QuickAction {
  mode: string;
  label: string;
  title: string;
}

const QUICK_GROUP_CLEAN: QuickAction[] = [
  { mode: 'minimal', label: 'Pulisci', title: 'Rimuovi campi vuoti e placeholder, layout essenziale' },
  { mode: 'print', label: 'Stampa', title: 'Verifica contrasto e leggibilità per la stampa fisica' },
];

const QUICK_GROUP_PERSONALIZE: QuickAction[] = [
  { mode: 'premium', label: 'Premium', title: 'Rendi più elegante e professionale' },
  { mode: 'fill', label: 'Suggerisci', title: 'Genera titolo e social plausibili dal nome' },
  { mode: 'palette', label: 'Palette', title: 'Cambia i colori (teal, navy, bordeaux, mono)' },
  { mode: 'moveQr', label: 'Sposta QR', title: 'Sposta il QR a sinistra' },
  { mode: 'growPhoto', label: 'Allarga foto', title: 'Aumenta la larghezza della foto' },
];

// TB-023 REQ-PD-008: decoration quick chips.
const QUICK_GROUP_DECORATION: QuickAction[] = [
  { mode: 'decorationWave', label: 'Onda', title: 'Aggiungi onda decorativa in basso' },
  { mode: 'decorationBlob', label: 'Blob', title: 'Aggiungi blob decorativo in un angolo' },
  { mode: 'decorationSplash', label: 'Splash', title: 'Aggiungi splash decorativo agli angoli' },
  { mode: 'decorationFull', label: 'Overlay', title: 'Aggiungi overlay pieno come sfondo' },
  { mode: 'decorationClear', label: 'No decoro', title: 'Rimuovi la decorazione' },
];

export interface CardAIQuickActionsProps {
  isProcessing: boolean;
  onRun: (mode: string) => void;
}

function QuickGroup({
  items,
  label,
  isProcessing,
  onRun,
}: {
  items: QuickAction[];
  label: string;
  isProcessing: boolean;
  onRun: (mode: string) => void;
}) {
  return (
    <AiActionGrid groupLabel={label}>
      {items.map((a) => (
        <AiActionChip
          key={a.mode}
          label={a.label}
          onClick={() => onRun(a.mode)}
          disabled={isProcessing}
          title={a.title}
        />
      ))}
    </AiActionGrid>
  );
}

export default function CardAIQuickActions({ isProcessing, onRun }: CardAIQuickActionsProps) {
  return (
    <AiSection
      title="Stile veloce"
      id="card-ai-section-style"
      hint="Modifiche rapide con un click. Cambiano solo i campi della card."
      collapsible
      defaultOpen
    >
      <QuickGroup items={QUICK_GROUP_CLEAN} label="Pulisci" isProcessing={isProcessing} onRun={onRun} />
      <QuickGroup items={QUICK_GROUP_PERSONALIZE} label="Personalizza" isProcessing={isProcessing} onRun={onRun} />
      <QuickGroup items={QUICK_GROUP_DECORATION} label="Decorazione" isProcessing={isProcessing} onRun={onRun} />
    </AiSection>
  );
}
