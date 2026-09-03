/**
 * Core types. Everything in this file is deterministic domain vocabulary —
 * no I/O, no network, no model.
 */

export const SUPPORTED_COUNTRIES = ['CZ', 'AT', 'SI', 'SK', 'HU', 'HR'] as const;
export const LISTED_COUNTRIES = ['CH', 'RO', 'BG'] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];
export type ListedCountry = (typeof LISTED_COUNTRIES)[number];
export type CountryCode = SupportedCountry | ListedCountry;

export type Powertrain =
  | 'petrol'
  | 'diesel'
  | 'hybrid'
  | 'phev'
  | 'bev'
  | 'hydrogen'
  | 'cng'
  | 'lng'
  | 'biomethane';

export type VehicleCategory = 'car' | 'motorcycle';

/**
 * What the user tells us about the vehicle. Optional dimensions are genuinely
 * optional: when a country needs one we do not guess, we ask (see `needs-input`).
 */
export interface Vehicle {
  category: VehicleCategory;
  /** Technically permissible maximum laden mass, in kilograms. */
  maxWeightKg: number;
  /** Slovenia decides class 2A vs 2B on this, not on total height. */
  heightAboveFrontAxleM?: number;
  /** Croatia decides its class on total height at the 1.9 m line. */
  totalHeightM?: number;
  powertrain?: Powertrain;
  co2GramsPerKm?: number;
  plate?: string;
  registrationCountry?: string;
  /** A trailer in tow. Some countries charge it separately. */
  trailer?: { maxWeightKg: number };
}

/** ISO dates, `YYYY-MM-DD`, inclusive on both ends. */
export interface DateRange {
  from: string;
  to: string;
}

export type PurchaseChannel = 'online' | 'retail';

export interface ResolveInput {
  route: CountryCode[];
  vehicle: Vehicle;
  dates: DateRange;
  /** When and how the user would buy. Drives Austria's 18-day rule. */
  purchase?: { on?: string; channel?: PurchaseChannel };
  /** Overrides "now" — tests and reproducible runs depend on this. */
  today?: string;
  /** Rules older than this produce a staleness warning. */
  maxDataAgeDays?: number;
}

export type Severity = 'info' | 'warning' | 'blocking';

export interface Note {
  id: string;
  severity: Severity;
  text: string;
  source?: string;
  verifiedAt?: string;
}

export interface Money {
  amount: number;
  currency: string;
}

export interface Option {
  productId: string;
  label: string;
  kind: string;
  price: Money;
  /** Earliest day this product could start, given purchase date and channel. */
  validFrom: string;
  validTo: string;
  /** Does this single product cover the whole trip? */
  coversTrip: boolean;
  reason?: string;
  buyUrl: string;
  source: string;
  verifiedAt: string;
  notes: string[];
}

export type Requirement =
  | {
      country: CountryCode;
      kind: 'vignette';
      tollClass: string;
      tollClassLabel: string;
      options: Option[];
      recommended: string | null;
      buyUrl: string;
      checkUrl?: string;
      notes: Note[];
    }
  | {
      country: CountryCode;
      kind: 'pay-on-site';
      /** Nothing to buy in advance. Say so and stop. */
      notes: Note[];
      buyUrl: string;
    }
  | {
      country: CountryCode;
      kind: 'section-toll';
      tolls: { id: string; name: string; price: Money | null; hint?: string }[];
      buyUrl: string;
      notes: Note[];
    }
  | { country: CountryCode; kind: 'not-required'; notes: Note[] }
  | { country: CountryCode; kind: 'needs-input'; missing: string[]; notes: Note[] }
  | { country: CountryCode; kind: 'out-of-scope'; notes: Note[]; seeAlso?: string }
  | { country: CountryCode; kind: 'unsupported'; notes: Note[]; buyUrl?: string };

export interface ResolveResult {
  input: ResolveInput;
  requirements: Requirement[];
  warnings: Note[];
  /** Sum per currency of the recommended options. Never a single number — we do not invent FX rates. */
  estimatedTotal: Money[];
  generatedAt: string;
}

/** Read-only result of asking a portal what a plate already has. */
export interface Coverage {
  country: CountryCode;
  plate: string;
  product: string;
  validFrom: string;
  validTo: string;
  raw?: unknown;
}
