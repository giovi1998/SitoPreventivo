import React from 'react';
import Icon from './Icon.jsx';

export default function CollectionView({ quotes, activeId, openQuote, duplicate, removeQuote }) {
  const money = (value) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(Number(value || 0));

  return (
    <div className="collection-view">
      <div className="collection-head"><p>Preventivi salvati</p><h2>Collection</h2><span>Modifica, duplica o elimina vecchi preventivi.</span></div>
      <div className="collection-grid">{quotes.map((item) => {
        const firstOption = item.options?.[0];
        const total = firstOption ? firstOption.oneTimeCost : 0;
        return (
          <article className={item.id === activeId ? 'collection-card active' : 'collection-card'} key={item.id}>
            <div className="card-top"><span className={`status ${(item.status || 'bozza').toLowerCase()}`}>{item.status}</span><b>{item.id}</b></div>
            <h3>{item.title}</h3><p>{item.client}</p>
            <div className="card-meta"><span>{item.date}</span><strong>{money(total)}</strong></div>
            <div className="card-actions"><button onClick={() => openQuote(item)}><Icon name="edit" />Modifica</button><button onClick={() => duplicate(item)}><Icon name="copy" />Duplica</button><button onClick={() => removeQuote(item.id)}><Icon name="trash" />Elimina</button></div>
          </article>
        );
      })}</div>
    </div>
  );
}
