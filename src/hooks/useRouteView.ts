import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const ROUTE_PATHS: Record<string, string> = {
  editor: '/app/editor',
  collection: '/app/collection',
  qr: '/app/qr',
  card: '/app/card',
  logo: '/app/logo',
  flyer: '/app/flyer',
  settings: '/app/settings',
  admin: '/app/admin',
};

const PATH_TO_VIEW: Record<string, string> = Object.fromEntries(
  Object.entries(ROUTE_PATHS).map(([view, path]) => [path, view])
);

const DEFAULT_VIEW = 'editor';

function pathToView(pathname: string): string {
  if (PATH_TO_VIEW[pathname]) return PATH_TO_VIEW[pathname];
  if (pathname === '/app' || pathname === '/app/') return DEFAULT_VIEW;
  return DEFAULT_VIEW;
}

function viewToPath(view: string): string {
  return ROUTE_PATHS[view] || ROUTE_PATHS[DEFAULT_VIEW];
}

export interface RouteView {
  view: string;
  setView: (v: string) => void;
}

export function useRouteView(): RouteView {
  const location = useLocation();
  const navigate = useNavigate();

  const view = useMemo(() => pathToView(location.pathname), [location.pathname]);

  const setView = useCallback(
    (v: string) => {
      navigate(viewToPath(v));
    },
    [navigate]
  );

  return { view, setView };
}
