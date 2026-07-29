import { useCallback, useEffect, useState } from 'react';
import dataService from '../../utils/dataService';
import { intakeToAllDocuments } from '../../utils/intakeToDocument';
import './crm.css';

type Intake = Record<string, unknown> & {
  id: string;
  status: string;
  businessName: string;
  sector?: string | null;
  package?: string | null;
  ownerName?: string | null;
  activity?: string | null;
  mood?: string | null;
  target?: string | null;
  preferredColors?: string | null;
  contacts?: Record<string, unknown> | null;
  createdAt?: string;
};

export default function IntakeList() {
  const [intakes, setIntakes] = useState<Intake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await dataService.getIntakes('new');
    if (res.error) setError(res.error);
    else setIntakes((res.data as Intake[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleOpen = async (intake: Intake) => {
    setOpeningId(intake.id);
    setError(null);
    const drafts = intakeToAllDocuments({
      businessName: intake.businessName,
      ownerName: intake.ownerName,
      sector: intake.sector,
      activity: intake.activity,
      mood: intake.mood,
      target: intake.target,
      preferredColors: intake.preferredColors,
      contacts: intake.contacts,
      package: intake.package,
    });
    for (const draft of drafts) {
      await dataService.saveDocument('admin@gmail.com', {
        id: draft.documentType + '_' + Math.random().toString(36).slice(2, 10),
        documentType: draft.documentType,
        title: draft.title,
        data: draft.data,
        status: 'BOZZA',
      } as Record<string, unknown>);
    }
    await dataService.updateIntake(intake.id, { status: 'in_progress', assignedTo: 'admin@gmail.com' });
    setOpeningId(null);
    await load();
  };

  if (loading) return <div className="intake-list" data-testid="intake-list"><p>Brief in caricamento…</p></div>;
  if (error) return <div className="intake-list"><p className="crm-error">{error}</p></div>;
  if (intakes.length === 0) return null;

  return (
    <section className="intake-list" data-testid="intake-list">
      <h3>Brief da lavorare ({intakes.length})</h3>
      <ul className="intake-cards">
        {intakes.map((i) => (
          <li key={i.id} className="intake-card" data-testid={`intake-card-${i.id}`}>
            <div className="intake-card-info">
              <strong>{i.businessName}</strong>
              <div className="intake-card-meta">
                {i.sector && <span>{i.sector}</span>}
                {i.package && <span>· {i.package}</span>}
                {i.createdAt && <span>· {new Date(i.createdAt as string).toLocaleDateString('it-IT')}</span>}
              </div>
            </div>
            <button
              onClick={() => handleOpen(i)}
              disabled={openingId === i.id}
              data-testid={`intake-open-${i.id}`}
            >
              {openingId === i.id ? 'Apertura…' : 'Apri'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}