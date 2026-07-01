import React, { Suspense, useContext } from 'react';
import CollectionView from '../../components/CollectionView';
import CollectionViewSkeleton from '../../components/CollectionViewSkeleton';
import { AppContext } from '../../contexts';

// Phase 7 fix: questa pagina ora è accessibile a tutti gli utenti
// loggati. La logica "preventivi sono admin-only" sta solo nei
// tab del CollectionView (che nasconde il tab "Preventivi" per i
// non-admin) e nella route `editor` di main.tsx (che resta
// admin-only). Non c'è più un redirect server-side che blocca i
// non-admin.
export default function CollectionPage() {
  const ctx = useContext(AppContext) as any;

  return (
    <Suspense fallback={<CollectionViewSkeleton />}>
      <CollectionView activeId={ctx.editingQuote?.quoteId} />
    </Suspense>
  );
}
