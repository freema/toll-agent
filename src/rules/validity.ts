import { addDays, addMonths, maxDate } from '../data/dates.js';
import type { Product } from '../data/schema.js';
import type { DateRange, PurchaseChannel } from '../types.js';

export interface Window {
  from: string;
  to: string;
}

export interface CoverageInput {
  product: Product;
  trip: DateRange;
  purchaseOn: string;
  channel: PurchaseChannel;
}

/**
 * The earliest day a product bought on `purchaseOn` through `channel` can start.
 *
 * This is where Austria's 18-day rule lives: a 2-month or annual digital
 * vignette bought online is valid at the earliest from the 18th day after
 * purchase, because the statutory 14-day withdrawal period has to run out
 * first. Buying the same product at a petrol station is not distance selling,
 * so it starts today.
 */
export function earliestStart(product: Product, purchaseOn: string, channel: PurchaseChannel): string {
  const online = product.online;
  if (!online || online.validFromDays === 0) return purchaseOn;
  if (online.immediateChannels?.includes(channel)) return purchaseOn;
  if (channel !== 'online') return purchaseOn;
  return addDays(purchaseOn, online.validFromDays);
}

/** The window a product covers if it starts on `start`. */
export function windowFrom(product: Product, start: string): Window {
  switch (product.validity.type) {
    case 'rolling-days':
      return { from: start, to: addDays(start, product.validity.days - 1) };
    case 'rolling-months':
      return { from: start, to: addDays(addMonths(start, product.validity.months), -1) };
    case 'season':
      return { from: product.validity.from, to: product.validity.to };
  }
}

export interface CoverageVerdict {
  window: Window;
  coversTrip: boolean;
  reason?: string;
}

/**
 * Would this single product cover the whole trip? We never silently shift the
 * trip to fit a product — if the product cannot start early enough, it does not
 * cover, and we say why.
 */
export function coverage({ product, trip, purchaseOn, channel }: CoverageInput): CoverageVerdict {
  const earliest = earliestStart(product, purchaseOn, channel);

  if (product.validity.type === 'season') {
    const window = windowFrom(product, product.validity.from);
    const effectiveFrom = maxDate(window.from, earliest);
    const covers = effectiveFrom <= trip.from && window.to >= trip.to;
    const verdict: CoverageVerdict = { window: { from: effectiveFrom, to: window.to }, coversTrip: covers };
    if (!covers) {
      verdict.reason =
        effectiveFrom > trip.from
          ? `Cannot be valid before ${effectiveFrom}; the trip starts ${trip.from}.`
          : `Season ends ${window.to}; the trip runs to ${trip.to}.`;
    }
    return verdict;
  }

  const start = maxDate(trip.from, earliest);
  const window = windowFrom(product, start);
  const covers = window.from <= trip.from && window.to >= trip.to;
  const verdict: CoverageVerdict = { window, coversTrip: covers };
  if (!covers) {
    verdict.reason =
      window.from > trip.from
        ? `Cannot start before ${window.from}; the trip starts ${trip.from}. Buy earlier, buy off-line, or pick a product that is valid immediately.`
        : `Runs out on ${window.to}; the trip runs to ${trip.to}.`;
  }
  return verdict;
}
