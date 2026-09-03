import { SUPPORTED_COUNTRIES, type SupportedCountry } from '../types.js';
import { manualAdapter } from './manual.js';
import type { Adapter } from './types.js';

const registry = new Map<SupportedCountry, Adapter>(
  SUPPORTED_COUNTRIES.map((code) => [code, manualAdapter(code)]),
);
const automated = new Set<SupportedCountry>();

/**
 * Adapters are opt-in. Registering one replaces the manual fallback for that
 * country; an adapter that cannot finish is expected to return a manual handoff
 * rather than throw.
 */
export function registerAdapter(adapter: Adapter): void {
  if (!(SUPPORTED_COUNTRIES as readonly string[]).includes(adapter.country)) {
    throw new Error(`${adapter.country} is not in scope for v1`);
  }
  const code = adapter.country as SupportedCountry;
  registry.set(code, adapter);
  automated.add(code);
}

export function adapterFor(code: SupportedCountry): Adapter {
  const adapter = registry.get(code);
  if (!adapter) throw new Error(`No adapter for ${code}`);
  return adapter;
}

export function listAdapters(): { country: SupportedCountry; automated: boolean }[] {
  return SUPPORTED_COUNTRIES.map((code) => ({ country: code, automated: automated.has(code) }));
}
