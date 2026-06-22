import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext } from '../../contexts';

const QREditor = lazy(() => import('../../components/QREditor'));

export default function QrPage() {
  const { user } = useContext(AuthContext);
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <QREditor userEmail={user?.email || ''} />
    </Suspense>
  );
}
