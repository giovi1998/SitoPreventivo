import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

/** React Router v7 future flags — same as production BrowserRouter in main.tsx */
export const ROUTER_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

export function TestRouter({
  children,
  initialEntries = ['/'],
}: {
  children: ReactNode;
  initialEntries?: string[];
}) {
  return (
    <MemoryRouter initialEntries={initialEntries} future={ROUTER_FUTURE}>
      {children}
    </MemoryRouter>
  );
}
