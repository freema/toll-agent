import type { Coverage, CountryCode, DateRange, Vehicle } from '../types.js';

export interface CheckRequest {
  plate: string;
  /** Some portals need the country of registration to look a plate up. */
  registrationCountry?: string;
}

export interface PurchaseRequest {
  productId: string;
  vehicle: Vehicle;
  dates: DateRange;
  runId: string;
}

/**
 * Every adapter can end in a manual handoff, and that is a supported outcome,
 * not a failure. A tool that says "here is the exact page, these are the values,
 * finish it yourself" survives a portal redesign. A tool that throws gets
 * uninstalled.
 */
export interface ManualHandoff {
  outcome: 'manual';
  url: string;
  prefill: Record<string, string>;
  instructions: string;
  reason: string;
}

export type CheckOutcome =
  | { outcome: 'ok'; coverage: Coverage[]; checkedAt: string }
  | ManualHandoff
  | { outcome: 'unsupported'; reason: string; url: string };

export type PurchaseOutcome =
  | { outcome: 'handed-off-to-payment'; runId: string; url: string; note: string }
  | ManualHandoff
  | { outcome: 'unsupported'; reason: string; url: string };

export interface Quote {
  productId: string;
  price: { amount: number; currency: string };
  validFrom: string;
  validTo: string;
  buyUrl: string;
  source: string;
  verifiedAt: string;
}

/**
 * One file per portal. Three methods, and only one of them touches a browser.
 *
 * `check` is the load-bearing one: it prevents double purchases, it is the only
 * acceptable proof that a purchase succeeded, and on its own it already answers
 * "is my Slovenian vignette still valid?".
 */
export interface Adapter {
  country: CountryCode;
  /** Read-only, no authentication, no side effects. */
  check(request: CheckRequest): Promise<CheckOutcome>;
  /** From static data. Never hits the network. */
  quote(productId: string, vehicle: Vehicle, dates: DateRange): Quote | null;
  /**
   * Drives the official form up to the payment gateway and stops there.
   * It must never submit a payment, store a card, or work around SCA.
   */
  purchase(request: PurchaseRequest): Promise<PurchaseOutcome>;
}
