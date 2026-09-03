export { resolve } from './rules/resolve.js';
export { classify, vehicleFacts } from './rules/classify.js';
export { coverage, earliestStart, windowFrom } from './rules/validity.js';
export {
  loadCountry,
  loadAllCountries,
  loadPortals,
  portalFor,
  officialHosts,
  isSupported,
} from './data/load.js';
export { match } from './data/predicate.js';
export * as dates from './data/dates.js';
export { Journal, UNSAFE_TO_RETRY } from './journal/journal.js';
export type { JournalEntry, StepState } from './journal/journal.js';
export { adapterFor, registerAdapter, listAdapters } from './adapters/registry.js';
export { manualAdapter } from './adapters/manual.js';
export type {
  Adapter,
  CheckOutcome,
  CheckRequest,
  ManualHandoff,
  PurchaseOutcome,
  PurchaseRequest,
  Quote,
} from './adapters/types.js';
export type {
  CountryCode,
  Coverage,
  DateRange,
  ListedCountry,
  Money,
  Note,
  Option,
  Powertrain,
  PurchaseChannel,
  Requirement,
  ResolveInput,
  ResolveResult,
  Severity,
  SupportedCountry,
  Vehicle,
  VehicleCategory,
} from './types.js';
export { SUPPORTED_COUNTRIES, LISTED_COUNTRIES } from './types.js';
