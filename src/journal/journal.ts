import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { CountryCode } from '../types.js';

/**
 * An append-only journal, written to disk BEFORE each step, not after.
 *
 * The failure this exists for: the process dies between submitting a payment
 * and seeing the confirmation. On restart we are in `payment-submitted` and we
 * must not repeat the step — we must ask the portal. Two vignettes for the same
 * plate are in practice unrefundable, because both CZ and AT only allow changes
 * before validity starts.
 */
export type StepState =
  | 'planned'
  | 'preflight-checked'
  | 'form-filled'
  | 'payment-submitted'
  | 'verified'
  | 'abandoned'
  | 'failed';

export interface JournalEntry {
  run: string;
  country: CountryCode;
  productId?: string;
  plate?: string;
  state: StepState;
  at: string;
  detail?: string;
}

/** States after which an automatic retry of the payment step is forbidden. */
export const UNSAFE_TO_RETRY: readonly StepState[] = ['payment-submitted'];

export class Journal {
  constructor(private readonly path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  /** Write first, act second. A step that was not journalled did not happen. */
  record(entry: Omit<JournalEntry, 'at'> & { at?: string }): JournalEntry {
    const complete: JournalEntry = { ...entry, at: entry.at ?? new Date().toISOString() };
    appendFileSync(this.path, `${JSON.stringify(complete)}\n`, 'utf8');
    return complete;
  }

  entries(): JournalEntry[] {
    if (!existsSync(this.path)) return [];
    return readFileSync(this.path, 'utf8')
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as JournalEntry);
  }

  /** The latest state recorded for a country within a run. */
  stateOf(run: string, country: CountryCode): StepState | null {
    const relevant = this.entries().filter(
      (entry) => entry.run === run && entry.country === country,
    );
    return relevant.at(-1)?.state ?? null;
  }

  /**
   * The idempotence gate. Called before every step that costs money.
   * `resume` never means "do it again"; it means "go ask the portal".
   */
  canProceed(run: string, country: CountryCode): { proceed: boolean; reason: string } {
    const state = this.stateOf(run, country);
    if (state === null) return { proceed: true, reason: 'no prior attempt in this run' };
    if (UNSAFE_TO_RETRY.includes(state)) {
      return {
        proceed: false,
        reason: `A payment for ${country} was already submitted in run ${run} and never confirmed. Do not repeat it. Call check() against the portal and record the real outcome.`,
      };
    }
    if (state === 'verified') {
      return { proceed: false, reason: `${country} is already verified as done in run ${run}.` };
    }
    return { proceed: true, reason: `resuming from state ${state}` };
  }
}
