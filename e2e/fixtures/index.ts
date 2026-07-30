export const testUser = {
  email: 'test@example.com',
  password: 'Password123!',
  username: 'Test',
  role: 'user',
};

export const adminUser = {
  email: 'admin@gmail.com',
  password: 'AdminPassword123!',
  username: 'Admin',
  role: 'admin',
};

export const freeUser = {
  email: 'free@example.com',
  password: 'UserPassword123!',
  username: 'FreeUser',
  role: 'user',
};

export const unlockedUser = {
  email: 'unlocked@example.com',
  password: 'UserPassword123!',
  username: 'UnlockedUser',
  role: 'user',
};

export const giovanniTemplate = {
  title: 'Bigliettino Giovanni Cidu',
  documentType: 'businessCard',
  front: {
    name: 'Giovanni Cidu',
    title: 'Full-Stack Developer',
    company: 'Quickbrand',
    layout: 'centered',
    useGrid: true,
  },
  back: {
    email: 'mario.rossi@example.com',
    phone: '+39 012 345 6789',
    website: 'https://giovannicidu.vercel.app',
    address: 'Cagliari, Italia',
    socials: [
      { platform: 'github', url: 'https://github.com/giovi1998' },
      { platform: 'linkedin', url: 'https://linkedin.com/in/giovannicidu' },
    ],
    qrPayload: 'https://giovannicidu.vercel.app',
    services: ['Sviluppo Web', 'UI Design', 'AI Engineering'],
  },
  style: {
    primaryColor: '#0F172A',
    accentColor: '#3B82F6',
    bgColor: '#FFFFFF',
    fontFamily: 'Inter',
  },
};

export const sampleFlyer = {
  title: 'Volantino Evento Estate',
  documentType: 'flyer',
  size: 'A5',
  orientation: 'portrait',
  content: {
    headline: 'Sagra del Paese',
    subheadline: '15 Agosto - Ingresso Libero',
    body: 'Cibo tipico, musica dal vivo, attività per famiglie e fuochi d\'artificio.',
    cta: { label: 'Prenota Ora', url: 'https://example.com' },
    qrPayload: 'https://example.com',
    qrLabel: 'Scansiona per info',
  },
  style: {
    layout: 'classic',
    primaryColor: '#B91C1C',
    secondaryColor: '#F59E0B',
    bgColor: '#FFFBEB',
    textColor: '#1E293B',
    fontFamily: 'Roboto',
  },
};

export const sampleQuote = {
  title: 'Preventivo Sito E-Commerce',
  documentType: 'quote',
  customerName: 'Acme Corp',
  items: [
    { description: 'Design UI/UX', quantity: 1, unitPrice: 800, total: 800 },
    { description: 'Sviluppo Frontend & Backend', quantity: 1, unitPrice: 2200, total: 2200 },
    { description: 'Integrazione Pagamenti', quantity: 1, unitPrice: 500, total: 500 },
  ],
  totalAmount: 3500,
  taxRate: 22,
};
