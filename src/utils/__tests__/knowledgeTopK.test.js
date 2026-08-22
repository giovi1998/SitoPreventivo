import { describe, it, expect } from 'vitest';
import { cosineSimilarity, topKChunks, mergeKnowledgeIntoBrief, isJunkChunk, filterJunkChunks, cleanMarkdownForKnowledge } from '../knowledgeTopK';

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

  describe('isJunkChunk (filtro spam research)', () => {
    it('chunk con caratteri di replacement (mojibake) → junk', () => {
      expect(isJunkChunk(`Odkryj ekscytuj${String.fromCharCode(0xfffd)}cy wiat${String.fromCharCode(0xfffd)} gier online i poczuj dreszczyk adrenaliny`)).toBe(true);
    });

    it('chunk dominato da URL di link (spam link farm) → junk', () => {
      const spam = '[vavada aplikacja](https://cor.com.pl/x) e [altra](https://spam.example/y) testo breve';
      expect(isJunkChunk(spam)).toBe(true);
    });

    it('testo italiano pulito → NON junk', () => {
      expect(isJunkChunk('La nostra storia nasce dalla passione per la cucina thailandese autentica.')).toBe(false);
    });

    it('chunk con un link markdown normale → NON junk', () => {
      expect(isJunkChunk('Prenota su [il nostro form](https://example.com/prenota) o chiamaci.')).toBe(false);
    });

    it('filterJunkChunks scarta junk e tiene il pulito', () => {
      const bad = String.fromCharCode(0xfffd);
      const out = filterJunkChunks([
        'Pad Thai autentico nel cuore di Cagliari.',
        `Odkryj ekscytuj${bad}cy wiat${bad} gier online`,
        '[spam](https://a.example/1) [spam](https://b.example/2) [spam](https://c.example/3)',
      ]);
      expect(out).toEqual(['Pad Thai autentico nel cuore di Cagliari.']);
    });

    it('input non stringa o vuoto → junk / array vuoto', () => {
      expect(isJunkChunk('')).toBe(true);
      expect(isJunkChunk(null)).toBe(true);
      expect(filterJunkChunks([])).toEqual([]);
    });

    it('cleanMarkdownForKnowledge: paragrafi spam rimossi, puliti uniti', () => {
      const bad = String.fromCharCode(0xfffd);
      const md = [
        'Un angolo di Thailandia nel cuore della Sardegna.',
        `Odkryj ekscytuj${bad}cy wiat${bad} gier online`,
        'Pad Thai autentico, ingredienti freschi.',
      ].join('\n\n');
      const out = cleanMarkdownForKnowledge(md);
      expect(out).toContain('Thailandia');
      expect(out).toContain('Pad Thai');
      expect(out).not.toContain('Odkryj');
    });

    it('cleanMarkdownForKnowledge: markdown vuoto/non stringa → stringa vuota', () => {
      expect(cleanMarkdownForKnowledge('')).toBe('');
      expect(cleanMarkdownForKnowledge(null)).toBe('');
    });
  });
});
