import React, { Suspense, lazy, useContext } from 'react';
import { AuthContext } from '../../contexts';

const LogoEditor = lazy(() => import('../../components/LogoEditor'));

export default function LogoPage() {
  const { user } = useContext(AuthContext);
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <LogoEditor userEmail={user?.email || ''} />
    </Suspense>
  );
}
