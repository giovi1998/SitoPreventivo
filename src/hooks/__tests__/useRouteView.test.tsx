import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import React from 'react';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

import { useRouteView, ROUTE_PATHS } from '../useRouteView';

function wrapper(initialPath: string) {
  return ({ children }: { children?: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>
  );
}

describe('useRouteView', () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
  });

  it('maps /app/editor to view="editor"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/editor') });
    expect(result.current.view).toBe('editor');
  });

  it('maps /app/collection to view="collection"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/collection') });
    expect(result.current.view).toBe('collection');
  });

  it('maps /app/qr to view="qr"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/qr') });
    expect(result.current.view).toBe('qr');
  });

  it('maps /app/card to view="card"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/card') });
    expect(result.current.view).toBe('card');
  });

  it('maps /app/flyer to view="flyer" (phase 3)', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/flyer') });
    expect(result.current.view).toBe('flyer');
  });

  it('maps /app/settings to view="settings"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/settings') });
    expect(result.current.view).toBe('settings');
  });

  it('maps /app/admin to view="admin"', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/admin') });
    expect(result.current.view).toBe('admin');
  });

  it('falls back to view="editor" on /app with no child path', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app') });
    expect(result.current.view).toBe('editor');
  });

  it('falls back to view="editor" on unknown child path (defensive default)', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/banana') });
    expect(result.current.view).toBe('editor');
  });

  it('setView("collection") navigates to /app/collection', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/editor') });
    act(() => result.current.setView('collection'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/collection');
  });

  it('setView("editor") navigates to /app/editor (default path)', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/qr') });
    act(() => result.current.setView('editor'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/editor');
  });

  it('setView("admin") navigates to /app/admin', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/editor') });
    act(() => result.current.setView('admin'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/admin');
  });

  it('setView("flyer") navigates to /app/flyer (phase 3)', () => {
    const { result } = renderHook(() => useRouteView(), { wrapper: wrapper('/app/editor') });
    act(() => result.current.setView('flyer'));
    expect(mocks.navigate).toHaveBeenCalledWith('/app/flyer');
  });

  it('exposes ROUTE_PATHS map with all 8 view keys', () => {
    expect(Object.keys(ROUTE_PATHS).sort()).toEqual(['admin', 'card', 'collection', 'editor', 'flyer', 'logo', 'qr', 'settings']);
    expect(ROUTE_PATHS.editor).toBe('/app/editor');
    expect(ROUTE_PATHS.admin).toBe('/app/admin');
    expect(ROUTE_PATHS.logo).toBe('/app/logo');
    expect(ROUTE_PATHS.flyer).toBe('/app/flyer');
  });
});
