import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';

export default function NotFoundPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #F6F8FC, #eef3fb 54%, #ffffff)',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>
      <div style={{
        width: '120px',
        height: '120px',
        borderRadius: '24px',
        background: 'rgba(11, 87, 208, 0.1)',
        display: 'grid',
        placeItems: 'center',
        marginBottom: '24px'
      }}>
        <Icon name="alert" />
      </div>
      
      <h1 style={{
        fontSize: '72px',
        fontWeight: '950',
        color: '#07111f',
        margin: '0 0 16px 0',
        lineHeight: '1'
      }}>404</h1>
      
      <h2 style={{
        fontSize: '24px',
        fontWeight: '800',
        color: '#07111f',
        margin: '0 0 12px 0'
      }}>Pagina non trovata</h2>
      
      <p style={{
        fontSize: '16px',
        color: '#647086',
        margin: '0 0 32px 0',
        maxWidth: '400px'
      }}>
        La pagina che stai cercando non esiste o è stata spostata.
      </p>
      
      <Link to="/" style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '12px 24px',
        background: '#0B57D0',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: '12px',
        fontWeight: '850',
        fontSize: '14px',
        border: 'none',
        cursor: 'pointer',
        transition: 'transform 0.16s ease, box-shadow 0.16s ease'
      }}>
        <Icon name="home" />
        Torna alla home
      </Link>
      
      <div style={{
        marginTop: '48px',
        padding: '16px 24px',
        background: 'rgba(255, 255, 255, 0.8)',
        borderRadius: '12px',
        border: '1px solid #c8d0df'
      }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#647086' }}>
          Se pensi sia un errore, contatta <strong>Giovanni Cidu</strong>
        </p>
      </div>
    </div>
  );
}