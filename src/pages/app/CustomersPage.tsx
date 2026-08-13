import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import dataService from '../../utils/dataService';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import '../../components/crm/crm.css';

const CustomerList = lazy(() => import('../../components/crm/CustomerList'));
const CustomerDetail = lazy(() => import('../../components/crm/CustomerDetail'));

type CustomerRow = Record<string, unknown> & { id: string };

export default function CustomersPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSplash = false) => {
    if (showSplash) setLoading(true);
    setError(null);
    const res = await dataService.getCustomers();
    if (res.error) {
      setError(res.error);
    } else {
      setCustomers((res.data as CustomerRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(true); }, [load]);
  useRefetchOnFocus(load);

  const handleSelect = useCallback((id: string) => navigate(`/app/customers/${id}`), [navigate]);
  const handleBack = useCallback(() => navigate('/app/customers'), [navigate]);
  // Refresh silenzioso: non smonta CustomerDetail durante la generazione AI
  // (niente splash: il dettaglio ha il proprio loading interno).
  const handleRefresh = useCallback(() => { void load(); }, [load]);

  // Splash solo per la lista: il dettaglio ha il proprio loading interno
  // (CustomerDetail gestisce `loading`) — mai smontarlo per un refresh.
  if (loading && !customerId) return <div className="crm-page"><p>Caricamento clienti…</p></div>;
  if (error && !customerId) return <div className="crm-page"><p className="crm-error">{error}</p></div>;

  return (
    <div className="crm-page">
      <Suspense fallback={<p>Caricamento…</p>}>
        {customerId ? (
          <CustomerDetail customerId={customerId} onBack={handleBack} onRefresh={handleRefresh} />
        ) : (
          <CustomerList customers={customers} onSelect={handleSelect} onRefresh={handleRefresh} />
        )}
      </Suspense>
    </div>
  );
}