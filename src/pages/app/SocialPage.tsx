import React, { useEffect, useState, Suspense, useContext } from 'react';
import SocialEditor from '../../components/SocialEditor';
import { AuthContext } from '../../contexts';
import dataService from '../../utils/dataService';
import type { BusinessCard, Flyer } from '../../utils/documentSchemas';

export default function SocialPage() {
  const { user } = useContext(AuthContext);
  const [cards, setCards] = useState<BusinessCard[]>([]);
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    let active = true;
    dataService.getDocuments(user.email)
      .then((result: unknown) => {
        if (!active) return;
        const wrapped = result as { documents?: Array<{ documentType?: string }> };
        const arr = wrapped?.documents ?? [];
        setCards(arr.filter((d) => d.documentType === 'businessCard') as unknown as BusinessCard[]);
        setFlyers(arr.filter((d) => d.documentType === 'flyer') as unknown as Flyer[]);
      })
      .catch(() => { if (active) { setCards([]); setFlyers([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.email]);

  if (!user?.email) return null;
  if (loading) return <div className="social-loading">Caricamento documenti…</div>;

  return (
    <Suspense fallback={<div className="social-loading">Caricamento…</div>}>
      <SocialEditor
        userEmail={user.email}
        cardDocuments={cards}
        flyerDocuments={flyers}
      />
    </Suspense>
  );
}