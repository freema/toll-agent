import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadAllCountries, loadPortals, officialHosts } from '../src/data/load.js';
import { SUPPORTED_COUNTRIES } from '../src/types.js';

const countries = loadAllCountries();
const portals = loadPortals();

/**
 * Domains a user must never be sent to. The 20-30% markup resellers are the
 * reason this project exists; a test is a cheaper guard than a code review.
 */
const FORBIDDEN_FRAGMENTS = [
  'vignette.',
  'vignetteswitzerland',
  'e-vignette',
  'dalnicni-znamky',
  'dalnicniznamka',
  'autoban',
  'tolltickets',
  'vignetteshop',
  'buy-vignette',
];

/** Every host our data is allowed to mention: official shops plus official toll systems. */
const ALLOWED_HOST_SUFFIXES = [
  'gov.cz',
  'asfinag.at',
  'dars.si',
  'darsgo.si',
  'eznamka.sk',
  'emyto.sk',
  'nemzetiutdij.hu',
  'hu-go.hu',
  'hac.hr',
  'via.admin.ch',
  'erovinieta.ro',
  'bgtoll.bg',
  'go-maut.at',
  'astra.admin.ch',
  'mt.ro',
  'mtc.government.bg',
];

function urlsIn(value: unknown): string[] {
  return JSON.stringify(value).match(/https?:\/\/[^"\s\\]+/g) ?? [];
}

describe('the data files are the product', () => {
  it('has a file for every supported country and no orphans', () => {
    const files = readdirSync('data/countries')
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', '').toUpperCase())
      .sort();
    expect(files).toEqual([...SUPPORTED_COUNTRIES].sort());
  });

  it('validates every country file against the schema', () => {
    expect(countries).toHaveLength(SUPPORTED_COUNTRIES.length);
  });

  it('gives every product a source and a verification date', () => {
    for (const country of countries) {
      for (const product of country.products) {
        expect(product.source, `${product.id} has no source`).toMatch(/^https:/);
        expect(product.verifiedAt, `${product.id} has no verification date`).toMatch(/^\d{4}-/);
      }
    }
  });

  it('gives every rule a source and a verification date', () => {
    for (const country of countries) {
      for (const rule of country.rules) {
        expect(rule.source, `${rule.id} has no source`).toMatch(/^https:/);
        expect(rule.verifiedAt, `${rule.id} has no verification date`).toMatch(/^\d{4}-/);
      }
    }
  });

  it('keeps product ids unique across all countries', () => {
    const ids = countries.flatMap((country) => country.products.map((product) => product.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every product at a toll class that exists', () => {
    for (const country of countries) {
      const classes = new Set(country.tollClasses.map((tollClass) => tollClass.id));
      for (const product of country.products) {
        expect(classes, `${product.id} in ${country.country}`).toContain(product.class);
      }
    }
  });

  it('never mentions a URL outside the official allowlist', () => {
    const raw = readdirSync('data/countries')
      .map((file) => readFileSync(`data/countries/${file}`, 'utf8'))
      .concat(readFileSync('data/portals.json', 'utf8'))
      .join('\n');
    for (const url of urlsIn(raw)) {
      const host = new URL(url.replace(/[",]+$/, '')).host;
      const allowed = ALLOWED_HOST_SUFFIXES.some(
        (suffix) => host === suffix || host.endsWith(`.${suffix}`),
      );
      expect(allowed, `${host} is not an official portal host`).toBe(true);
    }
  });

  it('contains no reseller-shaped domain anywhere', () => {
    const raw = readdirSync('data/countries')
      .map((file) => readFileSync(`data/countries/${file}`, 'utf8'))
      .concat(readFileSync('data/portals.json', 'utf8'))
      .join('\n')
      .toLowerCase();
    for (const url of urlsIn(raw)) {
      const host = new URL(url.replace(/[",]+$/, '')).host;
      for (const fragment of FORBIDDEN_FRAGMENTS) {
        expect(host.includes(fragment), `${host} looks like a reseller (${fragment})`).toBe(false);
      }
    }
  });

  it('never carries a verification date in the future', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const country of countries) {
      expect(country.verifiedAt <= today, `${country.country}`).toBe(true);
      for (const product of country.products) {
        expect(product.verifiedAt <= today, product.id).toBe(true);
      }
    }
  });

  it('keeps every country inside the 3.5 t scope of v1', () => {
    for (const country of countries) {
      expect(country.scopeLimit.maxWeightKg).toBe(3500);
    }
  });

  it('lists one official portal per country we model, plus the ones we only signpost', () => {
    const listed = portals.portals.map((portal) => portal.country);
    for (const code of SUPPORTED_COUNTRIES) expect(listed).toContain(code);
    expect(officialHosts().length).toBeGreaterThan(5);
  });

  it('records where the portal list itself came from', () => {
    expect(portals.signpost.url).toMatch(/edalnice\.gov\.cz/);
    expect(portals.signpost.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('has no product at all for Croatia, because none exists', () => {
    const croatia = countries.find((country) => country.country === 'HR');
    expect(croatia?.products).toHaveLength(0);
    expect(croatia?.system).toBe('toll-gate');
  });
});
