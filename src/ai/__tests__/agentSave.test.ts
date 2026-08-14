import { describe, it, expect } from 'vitest';
import { agentResultData, agentTypeOfDoc, docTypeOfTool } from '../agentSave';

describe('agentResultData', () => {
  it('logo con selected:-1 (scelta UI) salva il primo concept — regressione 2026-08-13', () => {
    // logoOrchestrator ritorna selected:-1: concepts[-1] = undefined →
    // agentResultData null → il logo non veniva MAI salvato in agent mode.
    const concepts = [{ primaryText: 'La Chiccheria' }, { primaryText: 'Altro' }];
    const data = agentResultData('logo', { name: 'generate_logo', ok: true, summary: '', data: { concepts, selected: -1, applied: true } });
    expect(data?.builder).toEqual({ primaryText: 'La Chiccheria' });
    expect(data?.concepts).toHaveLength(2);
  });

  it('logo con selected esplicito rispetta la scelta', () => {
    const concepts = [{ primaryText: 'A' }, { primaryText: 'B' }];
    const data = agentResultData('logo', { name: 'generate_logo', ok: true, summary: '', data: { concepts, selected: 1, applied: true } });
    expect(data?.builder).toEqual({ primaryText: 'B' });
  });

  it('card/flyer/website leggono le shape wrapped ({card}|{flyer}|{site})', () => {
    // executeTool ritorna data wrapped: agentResultData deve leggerla
    // (prima ritornava null → nessun save, badge "unknown" per sempre).
    const card = agentResultData('businessCard', { name: 'generate_card', ok: true, summary: '', data: { card: { front: { name: 'Mario' } } } });
    expect((card?.front as Record<string, unknown>).name).toBe('Mario');
    const flyer = agentResultData('flyer', { name: 'generate_flyer', ok: true, summary: '', data: { flyer: { content: { headline: 'H' } } } });
    expect((flyer?.content as Record<string, unknown>).headline).toBe('H');
    const site = agentResultData('website', { name: 'generate_website', ok: true, summary: '', data: { site: { html: '<html/>', css: 'c', js: 'j', pages: ['index'], pagesHtml: {} } } });
    expect(site?.html).toBe('<html/>');
    expect(site?.source).toBe('ai');
  });

  it('result non ok → null (niente save)', () => {
    expect(agentResultData('flyer', { name: 'generate_flyer', ok: false, summary: 'x', data: { flyer: {} } })).toBeNull();
  });
});

describe('agentTypeOfDoc / docTypeOfTool', () => {
  it("businessCard ↔ 'card' (include dei tool agent)", () => {
    // Senza questa mappa generate_card veniva filtrato via dall'include
    // e l'agente saltava la card (bug live 2026-08-13).
    expect(agentTypeOfDoc('businessCard')).toBe('card');
    expect(docTypeOfTool('generate_card')).toBe('businessCard');
    expect(agentTypeOfDoc('logo')).toBe('logo');
    expect(agentTypeOfDoc('website')).toBe('website');
    expect(agentTypeOfDoc('qrCode')).toBeUndefined();
  });
});
