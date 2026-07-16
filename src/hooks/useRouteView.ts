import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export const ROUTE_PATHS = {
  editor: '/app/editor',
  collection: '/app/collection',
  qr: '/app/qr',
  card: '/app/card',
  logo: '/app/logo',
  flyer: '/app/flyer',
  social: '/app/social',
  settings: '/app/settings',
  admin: '/app/admin',
} as const;

export type ViewName = keyof typeof ROUTE_PATHS;

const DEFAULT_VIEW: ViewName = 'editor';

function pathToView(pathname: string): ViewName {
  const match = pathname.match(/^\/app\/([a-z]+)(?:\/|$)/i);
  if (!match) return DEFAULT_VIEW;
  const seg = match[1].toLowerCase();
  return (seg in ROUTE_PATHS) ? (seg as ViewName) : DEFAULT_VIEW;
}

export function extractDocId(pathname: string): string | undefined {
  const match = pathname.match(/^\/app\/[a-z]+\/([a-zA-Z0-9_-]{1,100})(?:\/|$)/i);
  return match?.[1];
}

function viewToPath(view: ViewName): string {
  return ROUTE_PATHS[view] ?? ROUTE_PATHS[DEFAULT_VIEW];
}

export function buildPath(view: ViewName, docId?: string | null): string {
  const base = viewToPath(view);
  return docId ? `${base}/${docId}` : base;
}

export interface RouteView {
  view: ViewName;
  setView: (v: ViewName, docId?: string | null) => void;
  docId?: string;
}

export function useRouteView(): RouteView {
  const location = useLocation();
  const navigate = useNavigate();

  const view = useMemo(() => pathToView(location.pathname), [location.pathname]);
  const docId = useMemo(() => extractDocId(location.pathname), [location.pathname]);

  const setView = useCallback(
    (v: ViewName, id?: string | null) => {
      navigate(buildPath(v, id));
    },
    [navigate]
  );

  return { view, setView, docId };
}
