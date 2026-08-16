import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestRouter } from '../../test/TestRouter';
import PrivacyPage from '../PrivacyPage';

describe('PrivacyPage (TB-022)', () => {
  it('renders GDPR sections and contact', () => {
    render(<TestRouter><PrivacyPage /></TestRouter>);
    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByText(/Titolare del trattamento/i)).toBeInTheDocument();
    expect(screen.getByText(/Cookie e storage locale/i)).toBeInTheDocument();
    expect(screen.getByText(/I tuoi diritti/i)).toBeInTheDocument();
    expect(screen.getAllByText(/info@quickbrand\.it/i).length).toBeGreaterThan(0);
  });

  it('links back to home', () => {
    render(<TestRouter><PrivacyPage /></TestRouter>);
    expect(screen.getByText(/Torna alla home/i)).toBeInTheDocument();
  });
});
