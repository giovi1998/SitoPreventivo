import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardStyleFields } from '../CardStyleFields';
import { createEmptyCard } from '../../../../utils/documentSchemas';

describe('CardStyleFields', () => {
  function renderFields() {
    const card = createEmptyCard();
    return render(
      <CardStyleFields
        card={card}
        patchFront={vi.fn()}
        patchBack={vi.fn()}
        patchStyle={vi.fn()}
      />,
    );
  }

  it('renders the Stile fieldset with format/border/colors/font controls', () => {
    renderFields();
    expect(screen.getByLabelText(/Formato bigliettino/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stile bordo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Colore sfondo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Font del bigliettino/i)).toBeInTheDocument();
  });

  // REQ-CTRL-001 / REQ-TEST-005: il controllo globale "Dimensione testo" è
  // stato rimosso; il sizing è per-elemento (placement.scale) via
  // CardGridControls (slider grid-placement-zoom).
  it('does NOT render the global "Dimensione testo" slider (removed, REQ-CTRL-001)', () => {
    renderFields();
    expect(screen.queryByTestId('card-font-scale')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Dimensione testo$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Diminuisci dimensione testo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Aumenta dimensione testo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Reset dimensione testo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dimensione testo/i)).not.toBeInTheDocument();
  });
});
