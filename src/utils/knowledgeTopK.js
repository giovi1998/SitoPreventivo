// RAG retrieval: cosine similarity + top-k su chunk knowledge.
// JS puro, condiviso server (crm.ts) e client (firecrawlLocal.js).

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Chunk con embedding: [{ chunk, source?, embedding? }].
// Con query embedding: solo chunk con score > 0 (top k). Senza query:
// fallback ordine di inserimento (backward-compat chunk senza embedding).
export function topKChunks(chunks, queryEmbedding, k = 3) {
  if (!Array.isArray(chunks) || chunks.length === 0) return [];
  const hasQuery = Array.isArray(queryEmbedding) && queryEmbedding.length > 0;
  const scored = chunks.map((c, i) => ({
    chunk: c,
    score: hasQuery && Array.isArray(c.embedding) ? cosineSimilarity(c.embedding, queryEmbedding) : -1,
    index: i,
  }));
  const pool = hasQuery ? scored.filter((s) => s.score > 0) : scored;
  if (hasQuery && pool.length === 0) return chunks.slice(0, k);
  pool.sort((a, b) => b.score - a.score || a.index - b.index);
  return pool.slice(0, k).map((s) => s.chunk);
}

// Appende i chunk knowledge al briefContext (sezione "Contenuto sito web").
// Senza chunk → brief invariato. Usato da auto-build e dagli editor.
export function mergeKnowledgeIntoBrief(brief, chunks) {
  if (!Array.isArray(chunks) || chunks.length === 0) return brief;
  return `${brief}\nContenuto sito web:\n${chunks.join('\n')}`;
}
