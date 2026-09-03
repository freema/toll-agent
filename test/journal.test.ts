import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { Journal } from '../src/journal/journal.js';

function freshJournal(): Journal {
  return new Journal(join(mkdtempSync(join(tmpdir(), 'toll-agent-')), 'run.jsonl'));
}

describe('the journal exists to stop you buying two vignettes', () => {
  it('lets a fresh run proceed', () => {
    const journal = freshJournal();
    expect(journal.canProceed('run-1', 'CZ').proceed).toBe(true);
  });

  it('refuses to repeat a payment step that was submitted and never confirmed', () => {
    const journal = freshJournal();
    journal.record({ run: 'run-1', country: 'CZ', state: 'payment-submitted' });

    const verdict = journal.canProceed('run-1', 'CZ');
    expect(verdict.proceed).toBe(false);
    expect(verdict.reason).toMatch(/do not repeat/i);
    expect(verdict.reason).toMatch(/check\(\)/);
  });

  it('resumes an interrupted run from an earlier, safe state', () => {
    const journal = freshJournal();
    journal.record({ run: 'run-1', country: 'AT', state: 'planned' });
    journal.record({ run: 'run-1', country: 'AT', state: 'form-filled' });

    const verdict = journal.canProceed('run-1', 'AT');
    expect(verdict.proceed).toBe(true);
    expect(verdict.reason).toMatch(/form-filled/);
  });

  it('does not buy again what is already verified', () => {
    const journal = freshJournal();
    journal.record({ run: 'run-1', country: 'SI', state: 'payment-submitted' });
    journal.record({ run: 'run-1', country: 'SI', state: 'verified' });
    expect(journal.canProceed('run-1', 'SI').proceed).toBe(false);
  });

  it('keeps runs and countries apart', () => {
    const journal = freshJournal();
    journal.record({ run: 'run-1', country: 'CZ', state: 'payment-submitted' });
    expect(journal.canProceed('run-2', 'CZ').proceed).toBe(true);
    expect(journal.canProceed('run-1', 'SK').proceed).toBe(true);
  });

  it('is append-only and replayable in order', () => {
    const journal = freshJournal();
    journal.record({ run: 'run-1', country: 'CZ', state: 'planned' });
    journal.record({ run: 'run-1', country: 'CZ', state: 'preflight-checked' });
    journal.record({ run: 'run-1', country: 'CZ', state: 'payment-submitted' });

    const states = journal.entries().map((entry) => entry.state);
    expect(states).toEqual(['planned', 'preflight-checked', 'payment-submitted']);
    expect(journal.stateOf('run-1', 'CZ')).toBe('payment-submitted');
  });
});
