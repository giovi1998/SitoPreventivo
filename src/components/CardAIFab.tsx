interface CardAIFabProps {
  onClick: () => void;
  unreadCount?: number;
}

export default function CardAIFab({ onClick, unreadCount = 0 }: CardAIFabProps) {
  const label =
    unreadCount > 0
      ? `Apri pannello AI (${unreadCount} log non letti)`
      : 'Apri pannello AI';

  return (
    <button
      type="button"
      className="card-ai-fab"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z" />
        <path d="M19 4 L19.5 6 L21.5 6.5 L19.5 7 L19 9 L18.5 7 L16.5 6.5 L18.5 6 Z" />
      </svg>
      {unreadCount > 0 && (
        <span className="card-ai-fab-badge" aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}
