import { describe, it, expect } from 'vitest';
import { cosineSimilarity, topKChunks, mergeKnowledgeIntoBrief } from '../knowledgeTopK';

describe('knowledgeTopK', () => {
  it('cosineSimilarity: vettori identici → 1, ortogonali → 0, opposti → -1', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBe(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(-1);
  });

  it('cosineSimilarity: dimensioni diverse → 0 (nessun throw)', () => {
    expect(cosineSimilarity([1, 2], [1])).toBe(0);
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('topKChunks: ordina per similarità, chunk senza embedding in coda', () => {
    const chunks = [
      { chunk: 'A', embedding: [1, 0] },
      { chunk: 'B', embedding: [0, 1] },
      { chunk: 'C', embedding: [0.9, 0.1] },
      { chunk: 'D' },
    ];
    const top = topKChunks(chunks, [1, 0], 2);
    expect(top.map((c) => c.chunk)).toEqual(['A', 'C']);
  });

  it('topKChunks: fallback ordine di inserimento se nessun embedding (backward-compat)', () => {
    const chunks = [{ chunk: 'X' }, { chunk: 'Y' }];
    const top = topKChunks(chunks, [1, 0], 1);
    expect(top.map((c) => c.chunk)).toEqual(['X']);
    expect(topKChunks([], [1])).toEqual([]);
  });

  it('topKChunks: senza query embedding → ordine di inserimento (no filtro score)', () => {
    const chunks = [{ chunk: 'A', embedding: [0, 1] }, { chunk: 'B' }];
    expect(topKChunks(chunks, null, 2).map((c) => c.chunk)).toEqual(['A', 'B']);
  });

  it('topKChunks: con query, chunk ortogonali (score 0) esclusi', () => {
    const chunks = [
      { chunk: 'A', embedding: [0, 1] },
      { chunk: 'B', embedding: [1, 0] },
      { chunk: 'C', embedding: [-1, 0] },
    ];
    expect(topKChunks(chunks, [1, 0], 3).map((c) => c.chunk)).toEqual(['B']);
  });

  it('mergeKnowledgeIntoBrief: appende sezione "Contenuto sito web" se ci sono chunk', () => {
    const brief = 'Attività: Bar\nSettore: bar';
    const merged = mergeKnowledgeIntoBrief(brief, ['Pane e dolci sardi.', 'Forno a legna.']);
    expect(merged).toBe('Attività: Bar\nSettore: bar\nContenuto sito web:\nPane e dolci sardi.\nForno a legna.');
  });

  it('mergeKnowledgeIntoBrief: senza chunk → brief invariato', () => {
    const brief = 'Attività: Bar';
    expect(mergeKnowledgeIntoBrief(brief, [])).toBe(brief);
    expect(mergeKnowledgeIntoBrief(brief, null)).toBe(brief);
  });
});
