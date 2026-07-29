import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import dataService from '../../utils/dataService';
import '../../components/crm/crm.css';

const CustomerList = lazy(() => import('../../components/crm/CustomerList'));
const CustomerDetail = lazy(() => import('../../components/crm/CustomerDetail'));

type CustomerRow = Record<string, unknown> & { id: string };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await dataService.getCustomers();
    if (res.error) {
      setError(res.error);
    } else {
      setCustomers((res.data as CustomerRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleSelect = useCallback((id: string) => setSelectedId(id), []);
  const handleBack = useCallback(() => setSelectedId(null), []);
  const handleRefresh = useCallback(() => { void load(); }, [load]);

  if (loading) return <div className="crm-page"><p>Caricamento clienti…</p></div>;
  if (error) return <div className="crm-page"><p className="crm-error">{error}</p></div>;

  return (
    <div className="crm-page">
      <Suspense fallback={<p>Caricamento…</p>}>
        {selectedId ? (
          <CustomerDetail customerId={selectedId} onBack={handleBack} onRefresh={handleRefresh} />
        ) : (
          <CustomerList customers={customers} onSelect={handleSelect} onRefresh={handleRefresh} />
        )}
      </Suspense>
    </div>
  );
}