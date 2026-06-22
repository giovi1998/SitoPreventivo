import React, { Suspense, useContext } from 'react';
import CollectionView from '../../components/CollectionView';
import CollectionViewSkeleton from '../../components/CollectionViewSkeleton';
import { AppContext } from '../../contexts';

const CollectionViewLazy = CollectionView;

export default function CollectionPage() {
  const ctx = useContext(AppContext) as any;
  return (
    <Suspense fallback={<CollectionViewSkeleton />}>
      <CollectionViewLazy activeId={ctx.editingQuote?.quoteId} />
    </Suspense>
  );
}
