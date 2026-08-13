import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import CustomersPage from '../app/CustomersPage';
import dataService from '../../utils/dataService';
import { TestRouter } from '../../test/TestRouter';

const autoGenMocks = vi.hoisted(() => ({
  generateAll: vi.fn().mockResolvedValue(undefined),
  generateOne: vi.fn().mockResolvedValue(undefined),
  state: { statuses: {} as Record<string, string>, currentStep: null as string | null, running: false },
}));

vi.mock('../../hooks/useAutoBuildGenerate', () => ({
  useAutoBuildGenerate: () => ({
    state: autoGenMocks.state,
    generateAll: autoGenMocks.generateAll,
    generateOne: autoGenMocks.generateOne,
  }),
}));

vi.mock('../../utils/dataService', () => ({
  default: {
    getCustomers: vi.fn(),
    getCustomer: vi.fn(),
    createCustomer: vi.fn().mockResolvedValue({ data: {} }),
    deleteCustomer: vi.fn().mockResolvedValue({ data: { id: 'c1' } }),
    researchCustomer: vi.fn().mockResolvedValue({ data: {} }),
    aiFillCustomer: vi.fn().mockResolvedValue({ data: {} }),
    autoBuildCustomer: vi.fn().mockResolvedValue({ data: {} }),
    updateCustomer: vi.fn().mockResolvedValue({ data: {} }),
    saveDocument: vi.fn().mockResolvedValue({ data: {} }),
    getCustomerKnowledge: vi.fn().mockResolvedValue({ data: [] }),
    getUserSettings: vi.fn().mockResolvedValue({ userEmail: 'admin@gmail.com' }),
    saveUserSettings: vi.fn().mockResolvedValue({ success: true }),
  },
}));

const getCustomersMock = dataService.getCustomers as unknown as ReturnType<typeof vi.fn>;
const getCustomerMock = dataService.getCustomer as unknown as ReturnType<typeof vi.fn>;

const baseCustomer = {
  id: 'cust_1', businessName: 'Bar Da Mario', status: 'new', ownerName: 'Mario',
  sector: 'bar', contacts: { email: 'mario@example.com' }, documents: [],
};

beforeEach(() => {
  cleanup();
  getCustomersMock.mockReset();
  getCustomersMock.mockResolvedValue({ data: [baseCustomer] });
  getCustomerMock.mockReset();
  getCustomerMock.mockResolvedValue({ data: baseCustomer });
});

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location-path">{location.pathname}</span>;
}

function renderPage(initialPath: string) {
  return render(
    <TestRouter initialEntries={[initialPath]}>
      <LocationProbe />
      <Routes>
        <Route path="/app/customers" element={<CustomersPage />} />
        <Route path="/app/customers/:customerId" element={<CustomersPage />} />
      </Routes>
    </TestRouter>
  );
}

const LAZY_TIMEOUT = 15000;

describe('CustomersPage routing per URL', () => {
  it('deep link /app/customers/cust_1 mostra CustomerDetail', async () => {
    renderPage('/app/customers/cust_1');
    await waitFor(() => {
      expect(screen.getByTestId('crm-detail-title').textContent).toBe('Bar Da Mario');
    }, { timeout: LAZY_TIMEOUT });
    expect(getCustomerMock).toHaveBeenCalledWith('cust_1');
  });

  it('click su cliente nella lista naviga a /app/customers/<id>', async () => {
    renderPage('/app/customers');
    await waitFor(() => {
      expect(screen.getByTestId('crm-card-cust_1')).toBeTruthy();
    }, { timeout: LAZY_TIMEOUT });
    fireEvent.click(screen.getByTestId('crm-card-cust_1'));
    await waitFor(() => {
      expect(screen.getByTestId('location-path').textContent).toBe('/app/customers/cust_1');
    }, { timeout: LAZY_TIMEOUT });
    await waitFor(() => {
      expect(getCustomerMock).toHaveBeenCalledWith('cust_1');
    }, { timeout: LAZY_TIMEOUT });
  });

  it('pulsante Indietro dal dettaglio naviga a /app/customers', async () => {
    renderPage('/app/customers/cust_1');
    await waitFor(() => {
      expect(screen.getByTestId('crm-back')).toBeTruthy();
    }, { timeout: LAZY_TIMEOUT });
    fireEvent.click(screen.getByTestId('crm-back'));
    await waitFor(() => {
      expect(screen.getByTestId('location-path').textContent).toBe('/app/customers');
    }, { timeout: LAZY_TIMEOUT });
    await waitFor(() => {
      expect(screen.getByTestId('crm-card-cust_1')).toBeTruthy();
    }, { timeout: LAZY_TIMEOUT });
  });
});
