import React, { Suspense, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CollectionView from '../../components/CollectionView';
import CollectionViewSkeleton from '../../components/CollectionViewSkeleton';
import { AppContext, AuthContext } from '../../contexts';

const CollectionViewLazy = CollectionView;

export default function CollectionPage() {
  const ctx = useContext(AppContext) as any;
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  // I preventivi sono admin-only. I non-admin vengono redirezionati.
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/app/qr', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'admin') {
    return null;
  }

  return (
    <Suspense fallback={<CollectionViewSkeleton />}>
      <CollectionViewLazy activeId={ctx.editingQuote?.quoteId} />
    </Suspense>
  );
}
