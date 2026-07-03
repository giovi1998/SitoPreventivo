import './CardEditor.css';
import { CardAIFloatingProvider } from '../hooks/useCardAIFloating';
import CardEditorShell, { type CardEditorShellProps } from './card/CardEditorShell';

export default function CardEditorWrapper(props: CardEditorShellProps) {
  return (
    <CardAIFloatingProvider>
      <CardEditorShell {...props} />
    </CardAIFloatingProvider>
  );
}

export type { CardEditorShellProps as CardEditorProps };
