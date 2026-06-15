import React, { useState } from 'react';
import Icon from './Icon.jsx';

const STATUSES = ['BOZZA', 'INVIATO', 'ACCETTATO', 'RIFIUTATO'];
const STATUS_COLORS = {
  BOZZA: { bg: '#f0f1f5', color: '#666c7c' },
  INVIATO: { bg: '#e6eefc', color: '#0B57D0' },
  ACCETTATO: { bg: '#f7eddc', color: '#a66200' },
  RIFIUTATO: { bg: '#fef2f2', color: '#dc2626' },
};

export default function CollectionView({ quotes, activeId, openQuote, duplicate, removeQuote, onUpdateStatus }) {
  const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));

  return (
    <div className="collection-view">
      <div className="collection-head"><p>Preventivi salvati</p><h2>Collection</h2><span>Modifica, duplica o elimina vecchi preventivi.</span></div>
      <div className="collection-grid">{quotes.map((item) => {
        const firstOption = item.options?.[0];
        const total = firstOption ? firstOption.oneTimeCost : 0;
        const status = item.status || 'BOZZA';
        const statusStyle = STATUS_COLORS[status] || STATUS_COLORS.BOZZA;
        return (
          <article className={item.id === activeId ? 'collection-card active' : 'collection-card'} key={item.id}>
            <div className="card-top">
              <div className="status-dropdown" style={{ background: statusStyle.bg, color: statusStyle.color }}>
                <select
                  value={status}
                  onChange={(e) => onUpdateStatus && onUpdateStatus(item.id, e.target.value)}
                  style={{ background: statusStyle.bg, color: statusStyle.color }}
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <b>{item.id}</b>
            </div>
            <h3>{item.title}</h3><p>{item.client}</p>
            <div className="card-meta"><span>{item.date}</span><strong>{money(total)}</strong></div>
            <div className="card-actions"><button onClick={() => openQuote(item)}><Icon name="edit" />Modifica</button><button onClick={() => duplicate(item)}><Icon name="copy" />Duplica</button><button onClick={() => removeQuote(item.id)}><Icon name="trash" />Elimina</button></div>
          </article>
        );
      })}</div>
    </div>
  );
}
