import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { countrySchema, portalsSchema, type CountryData, type PortalsData } from './schema.js';
import { SUPPORTED_COUNTRIES, type CountryCode, type SupportedCountry } from '../types.js';

/**
 * `data/` sits next to `dist/` in the published package and next to `src/` in the
 * repo, so the same relative hop works either way.
 */
const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data');

let portalsCache: PortalsData | null = null;
const countryCache = new Map<string, CountryData>();

export function loadPortals(): PortalsData {
  if (!portalsCache) {
    const raw: unknown = JSON.parse(readFileSync(join(dataDir, 'portals.json'), 'utf8'));
    portalsCache = portalsSchema.parse(raw);
  }
  return portalsCache;
}

export function loadCountry(code: SupportedCountry): CountryData {
  const cached = countryCache.get(code);
  if (cached) return cached;
  const file = join(dataDir, 'countries', `${code.toLowerCase()}.json`);
  const raw: unknown = JSON.parse(readFileSync(file, 'utf8'));
  const parsed = countrySchema.parse(raw);
  if (parsed.country !== code) {
    throw new Error(`${file} declares country ${parsed.country} but was loaded as ${code}`);
  }
  countryCache.set(code, parsed);
  return parsed;
}

export function loadAllCountries(): CountryData[] {
  return SUPPORTED_COUNTRIES.map(loadCountry);
}

export function isSupported(code: string): code is SupportedCountry {
  return (SUPPORTED_COUNTRIES as readonly string[]).includes(code);
}

export function portalFor(code: CountryCode) {
  return loadPortals().portals.find((portal) => portal.country === code);
}

/**
 * The allowlist. Any URL this tool shows a user has to be here or be derived
 * from a rule's `source`. There is no path in the code that builds a shop URL
 * from user input.
 */
export function officialHosts(): string[] {
  const hosts = new Set<string>();
  for (const portal of loadPortals().portals) {
    hosts.add(new URL(portal.shop).host);
    if (portal.checkUrl) hosts.add(new URL(portal.checkUrl).host);
  }
  return [...hosts].sort();
}
