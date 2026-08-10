import { describe, it, expect, beforeEach } from 'vitest';
import { mockDbState, resetApiTests, callApiHandler } from './helpers/apiTest';

beforeEach(() => {
  resetApiTests();
});

describe('GET /api/users/cost-breakdown (admin, TB-023 REQ-TC-006)', () => {
  it('returns 403 when adminEmail query param is missing', async () => {
    const res = await callApiHandler({
      method: 'GET',
      url: '/api/users/cost-breakdown',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 403 when adminEmail is not admin@gmail.com', async () => {
    const res = await callApiHandler({
      method: 'GET',
      url: '/api/users/cost-breakdown?adminEmail=evil%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns per-user aggregates + ollamaProFlatMonthly with default days=30', async () => {
    mockDbState.selectResults = [[
      { email: 'heavy@gmail.com', tokensUsed: 50000, tokensCostUsd: '0.012345' },
      { email: 'light@gmail.com', tokensUsed: 100, tokensCostUsd: '0.000100' },
    ]];
    const res = await callApiHandler({
      method: 'GET',
      url: '/api/users/cost-breakdown?adminEmail=admin%40gmail.com',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.days).toBe(30);
    expect(res.body.ollamaProFlatMonthly).toBe(20);
    expect(res.body.users).toHaveLength(2);
    expect(res.body.users[0]).toEqual({
      email: 'heavy@gmail.com',
      tokensUsed: 50000,
      tokensCostUsd: 0.012345,
    });
  });

  it('echoes the requested days window (values stay lifetime aggregates)', async () => {
    mockDbState.selectResults = [[]];
    const res = await callApiHandler({
      method: 'GET',
      url: '/api/users/cost-breakdown?adminEmail=admin%40gmail.com&days=7',
      headers: { origin: 'http://localhost' },
      body: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.days).toBe(7);
    expect(res.body.users).toEqual([]);
  });
});
