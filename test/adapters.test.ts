import { describe, expect, it } from 'vitest';

import { adapterFor, listAdapters } from '../src/adapters/registry.js';
import { officialHosts } from '../src/data/load.js';

describe('adapters degrade to a manual handoff instead of failing', () => {
  it('reports honestly that nothing is automated in v1', () => {
    expect(listAdapters().every((entry) => entry.automated === false)).toBe(true);
  });

  it('hands a check off to the official portal with the plate to type in', async () => {
    const outcome = await adapterFor('CZ').check({ plate: '1AB2345' });
    expect(outcome.outcome).toBe('manual');
    if (outcome.outcome !== 'manual') return;
    expect(new URL(outcome.url).host).toBe('edalnice.gov.cz');
    expect(outcome.prefill.plate).toBe('1AB2345');
  });

  it('never claims coverage it did not read from a portal', async () => {
    const outcome = await adapterFor('SI').check({ plate: 'ABC123' });
    expect(outcome.outcome).not.toBe('ok');
  });

  it('quotes from static data without touching the network', () => {
    const quote = adapterFor('AT').quote(
      'at-10day-car',
      { category: 'car', maxWeightKg: 1800 },
      { from: '2026-07-15', to: '2026-07-20' },
    );
    expect(quote?.price).toEqual({ amount: 12.8, currency: 'EUR' });
    expect(quote?.source).toMatch(/asfinag\.at/);
  });

  it('hands a purchase off to the official shop and warns about the plate', async () => {
    const outcome = await adapterFor('AT').purchase({
      productId: 'at-10day-car',
      vehicle: { category: 'car', maxWeightKg: 1800, plate: '1AB2345' },
      dates: { from: '2026-07-15', to: '2026-07-20' },
      runId: 'run-1',
    });
    expect(outcome.outcome).toBe('manual');
    if (outcome.outcome !== 'manual') return;
    expect(officialHosts()).toContain(new URL(outcome.url).host);
    expect(outcome.instructions).toMatch(/character by character/i);
    expect(outcome.prefill.plate).toBe('1AB2345');
  });
});
