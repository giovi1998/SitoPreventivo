import React, { Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import CollectionView from '../../components/CollectionView';
import CollectionViewSkeleton from '../../components/CollectionViewSkeleton';
import { extractDocId } from '../../hooks/useRouteView';

// Phase 7 fix: questa pagina ora è accessibile a tutti gli utenti
// loggati. La logica "preventivi sono admin-only" sta solo nei
// tab del CollectionView (che nasconde il tab "Preventivi" per i
// non-admin) e nella route `editor` di main.tsx (che resta
// admin-only). Non c'è più un redirect server-side che blocca i
// non-admin.
// URL Document-ID Routing: active highlight is derived from the current
// editor URL (e.g. /app/card/abc), not from in-memory context.
export default function CollectionPage() {
  const location = useLocation();
  const activeId = extractDocId(location.pathname) || undefined;

  return (
    <Suspense fallback={<CollectionViewSkeleton />}>
      <CollectionView activeId={activeId} />
    </Suspense>
  );
}
