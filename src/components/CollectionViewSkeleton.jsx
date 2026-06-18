import React from 'react';

function SkeletonCard() {
  return (
    <article className="collection-card skeleton-card">
      <div className="skeleton-line" style={{ width: '60px', height: '20px' }} />
      <div className="skeleton-line" style={{ width: '80%', height: '18px' }} />
      <div className="skeleton-line" style={{ width: '50%', height: '14px' }} />
      <div className="skeleton-row">
        <div className="skeleton-line" style={{ width: '40%', height: '14px' }} />
        <div className="skeleton-line" style={{ width: '25%', height: '18px' }} />
      </div>
      <div className="skeleton-row">
        <div className="skeleton-line" style={{ width: '30%', height: '28px' }} />
        <div className="skeleton-line" style={{ width: '30%', height: '28px' }} />
      </div>
    </article>
  );
}

export default function CollectionViewSkeleton() {
  return (
    <div className="collection-view">
      <div className="collection-head">
        <div className="skeleton-line" style={{ width: '120px', height: '12px' }} />
        <div className="skeleton-line" style={{ width: '200px', height: '28px', marginTop: '8px' }} />
        <div className="skeleton-line" style={{ width: '250px', height: '14px', marginTop: '8px' }} />
      </div>
      <div className="collection-grid">
        {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}
