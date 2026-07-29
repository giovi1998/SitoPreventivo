import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import CustomerList from '../crm/CustomerList';
import dataService from '../../utils/dataService';
import { TestRouter } from '../../test/TestRouter';

vi.mock('../../utils/dataService', () => ({
  default: { createCustomer: vi.fn().mockResolvedValue({ data: {} }), deleteCustomer: vi.fn().mockResolvedValue({ data: { id: 'c1' } }) },
}));

beforeEach(() => {
  cleanup();
  (dataService.createCustomer as unknown as ReturnType<typeof vi.fn>).mockReset();
  (dataService.createCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
  (dataService.deleteCustomer as unknown as ReturnType<typeof vi.fn>).mockReset();
  (dataService.deleteCustomer as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { id: 'c1' } });
});

function renderList(customers: any[]) {
  return render(
    <TestRouter initialEntries={['/app/customers']}>
      <CustomerList customers={customers} onSelect={() => {}} onRefresh={() => {}} />
    </TestRouter>
  );
}

describe('TB-027 CustomerList', () => {
  it('render lista clienti con status badge', () => {
    renderList([{ id: 'c1', businessName: 'Bar XYZ', status: 'new', sector: 'bar' }]);
    expect(screen.getByText('Bar XYZ')).toBeTruthy();
    expect(screen.getByText('Nuovo')).toBeTruthy();
  });

  it('empty state mostra messaggio', () => {
    renderList([]);
    expect(screen.getByText(/Nessun cliente/)).toBeTruthy();
  });

  it('click su card chiama onSelect', () => {
    const onSelect = vi.fn();
    render(
      <TestRouter initialEntries={['/app/customers']}>
        <CustomerList customers={[{ id: 'c1', businessName: 'Bar' }]} onSelect={onSelect} onRefresh={() => {}} />
      </TestRouter>
    );
    fireEvent.click(screen.getByTestId('crm-card-c1'));
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('crea cliente chiama dataService.createCustomer', async () => {
    renderList([]);
    fireEvent.click(screen.getByText('+ Nuovo cliente'));
    fireEvent.change(screen.getByTestId('crm-create-businessname'), { target: { value: 'Nuovo Bar' } });
    fireEvent.click(screen.getByTestId('crm-create-submit'));
    await waitFor(() => {
      expect(dataService.createCustomer).toHaveBeenCalledWith(expect.objectContaining({ businessName: 'Nuovo Bar' }));
    });
  });

  it('click trash su card → ConfirmModal → deleteCustomer', async () => {
    const onRefresh = vi.fn();
    render(
      <TestRouter initialEntries={['/app/customers']}>
        <CustomerList customers={[{ id: 'c1', businessName: 'Bar' }]} onSelect={() => {}} onRefresh={onRefresh} />
      </TestRouter>
    );
    fireEvent.click(screen.getByTestId('crm-delete-card-c1'));
    expect(screen.getByText('Elimina definitivamente')).toBeTruthy();
    fireEvent.click(screen.getByText('Elimina definitivamente'));
    await waitFor(() => {
      expect(dataService.deleteCustomer).toHaveBeenCalledWith('c1');
      expect(onRefresh).toHaveBeenCalled();
    });
  });
});