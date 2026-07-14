/**
 * Shared AI error mapper for all AI hooks (quote, card, flyer, logo, social).
 * Maps HTTP status codes and common error strings to Italian user-facing hints.
 */

export function mapAiError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? 'Errore AI');
  const lower = msg.toLowerCase();

  if (
    lower.includes('402') ||
    lower.includes('payment') ||
    lower.includes('credito') ||
    lower.includes('insufficient')
  ) {
    return 'Credito DeepSeek esaurito. Ricarica su platform.deepseek.com e riprova.';
  }
  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('chiave') ||
    lower.includes('api key')
  ) {
    return 'Chiave API non valida. Verifica la configurazione server.';
  }
  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('troppe') ||
    lower.includes('quota')
  ) {
    return 'Troppe richieste AI. Attendi 30s e riprova.';
  }
  if (
    lower.includes('503') ||
    lower.includes('non configurat') ||
    lower.includes('mancante')
  ) {
    return 'Servizio AI non configurato. Contatta l\'amministratore.';
  }
  if (
    lower.includes('fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network') ||
    lower.includes('failed to fetch')
  ) {
    return 'Connessione assente o lenta. Verifica la rete e riprova.';
  }
  if (
    lower.includes('timeout') ||
    lower.includes('504') ||
    lower.includes('timed out') ||
    lower.includes('request timeout')
  ) {
    return 'Timeout AI. Riprova tra poco.';
  }
  if (
    lower.includes('json') ||
    lower.includes('parse') ||
    lower.includes('formato non valido') ||
    lower.includes('invalid') ||
    lower.includes('syntaxerror')
  ) {
    return 'AI non ha restituito JSON valido. Prova con un prompt più specifico (es. "cambia il titolo in X" invece di "migliora").';
  }
  if (lower.includes('413') || lower.includes('troppo grande')) {
    return 'Immagine troppo grande. Riprova con un prompt più semplice.';
  }
  if (lower.includes('copyright') || lower.includes('recitation') || lower.includes('blocked')) {
    return 'Generazione bloccata dal filtro di sicurezza. Prova un prompt più neutro.';
  }

  // Keep short raw messages if already Italian and concise.
  // 'unknown error' and similar generic English strings are not user-friendly,
  // so we still fall back to the generic Italian hint for them.
  const genericEnglishRaw = /^(unknown error|unexpected server error|server error|error)$/i;
  if (!genericEnglishRaw.test(msg.trim()) && msg.length <= 120 && !/^\d{3}/.test(msg.trim()) && /[a-z]/i.test(msg)) {
    return msg;
  }
  return 'Errore AI. Riprova, o modifica manualmente.';
}
