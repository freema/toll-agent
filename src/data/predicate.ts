/**
 * A tiny declarative matcher used by toll classes, product variants and rules.
 *
 * The point of the three-valued result is safety: when a country's class
 * depends on a dimension the user did not give us, we must not fall through to
 * "the cheap one". We return `unknown` and the caller asks.
 */

export type Comparison = {
  lt?: number;
  lte?: number;
  gt?: number;
  gte?: number;
  in?: (string | number | boolean)[];
  not?: string | number | boolean;
};

export type Predicate = Record<string, string | number | boolean | Comparison>;

export type MatchResult =
  | { result: 'yes' }
  | { result: 'no' }
  | { result: 'unknown'; missing: string[] };

function isComparison(value: unknown): value is Comparison {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compare(actual: unknown, expected: Comparison): MatchResult {
  if (expected.in !== undefined) {
    if (typeof actual !== 'string' && typeof actual !== 'number' && typeof actual !== 'boolean') {
      return { result: 'no' };
    }
    return expected.in.includes(actual) ? { result: 'yes' } : { result: 'no' };
  }
  if (expected.not !== undefined) {
    return actual !== expected.not ? { result: 'yes' } : { result: 'no' };
  }
  if (typeof actual !== 'number') return { result: 'no' };
  if (expected.lt !== undefined && !(actual < expected.lt)) return { result: 'no' };
  if (expected.lte !== undefined && !(actual <= expected.lte)) return { result: 'no' };
  if (expected.gt !== undefined && !(actual > expected.gt)) return { result: 'no' };
  if (expected.gte !== undefined && !(actual >= expected.gte)) return { result: 'no' };
  return { result: 'yes' };
}

/**
 * Every key in `predicate` must hold. A key whose value is missing from `subject`
 * makes the whole match `unknown` rather than `no`.
 */
export function match(predicate: Predicate | undefined, subject: Record<string, unknown>): MatchResult {
  if (!predicate) return { result: 'yes' };
  const missing: string[] = [];

  for (const [field, expected] of Object.entries(predicate)) {
    const actual = subject[field];
    if (actual === undefined || actual === null) {
      missing.push(field);
      continue;
    }
    const outcome = isComparison(expected)
      ? compare(actual, expected)
      : actual === expected
        ? ({ result: 'yes' } as const)
        : ({ result: 'no' } as const);
    if (outcome.result === 'no') return { result: 'no' };
  }

  return missing.length > 0 ? { result: 'unknown', missing } : { result: 'yes' };
}
