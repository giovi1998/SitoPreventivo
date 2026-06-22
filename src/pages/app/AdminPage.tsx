import React, { Suspense, lazy } from 'react';

const AdminDashboard = lazy(() => import('../AdminDashboard'));

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="view-loading"><div className="spinner" /></div>}>
      <AdminDashboard />
    </Suspense>
  );
}
