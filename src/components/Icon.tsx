import React from 'react';

const paths: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  folder: 'M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z',
  settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.5 3.5-1.9-.6a7.1 7.1 0 0 0-.7-1.7l.9-1.8-2.2-2.2-1.8.9c-.5-.3-1.1-.5-1.7-.7L12.5 4h-3l-.6 1.9c-.6.2-1.1.4-1.7.7l-1.8-.9-2.2 2.2.9 1.8c-.3.5-.5 1.1-.7 1.7L1.5 12l.6 3 1.9.6c.2.6.4 1.1.7 1.7l-.9 1.8 2.2 2.2 1.8-.9c.5.3 1.1.5 1.7.7l.6 1.9h3l.6-1.9c.6-.2 1.1-.4 1.7-.7l1.8.9 2.2-2.2-.9-1.8c.3-.5.5-1.1.7-1.7l1.9-.6z',
  edit: 'M4 20h4l11-11-4-4L4 16v4Zm12.5-16.5 4 4',
  copy: 'M8 8h10v13H8zM5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  trash: 'M4 7h16M9 7V4h6v3m-8 0 1 14h8l1-14',
  spark: 'M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z',
  download: 'M12 3v11m0 0 4-4m-4 4-4-4M5 20h14',
  alert: 'M12 2L2 22h20L12 2zm0 9v4m0 2h.01',
  home: 'M3 12l9-9 9 9M5 10v10h14V10',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-6 10a6 6 0 0 1 12 0',
  login: 'M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3',
  // Phase 6, document-type icons
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h6',
  'qr-code': 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM18 18h3v3h-3z',
  'id-card': 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM6 9h4M6 12h8M6 15h6M16 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
  'file-text': 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h8',
  sparkle: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
  close: 'M18 6L6 18M6 6l12 12',
  check: 'M20 6 9 17l-5-5',
};

export default function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name] || paths.spark} /></svg>;
}
