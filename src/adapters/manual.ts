import { loadCountry } from '../data/load.js';
import { coverage } from '../rules/validity.js';
import { todayISO } from '../data/dates.js';
import type { SupportedCountry, Vehicle, DateRange } from '../types.js';
import type { Adapter, CheckOutcome, PurchaseOutcome, PurchaseRequest, Quote } from './types.js';

/**
 * The adapter every country starts with, and the one every other adapter falls
 * back to. It automates nothing and links only to the official portal.
 *
 * This is deliberately the default: in v1 nothing drives a browser, so the tool
 * is honest about doing the thinking and leaving the clicking to you.
 */
export function manualAdapter(code: SupportedCountry): Adapter {
  const country = loadCountry(code);

  return {
    country: code,

    async check(request): Promise<CheckOutcome> {
      return {
        outcome: 'manual',
        url: country.checkUrl ?? country.portal,
        prefill: { plate: request.plate },
        instructions: `Open the official ${code} portal and check the plate ${request.plate} there. No adapter drives this portal yet, and we do not want to tell you what a portal did not tell us.`,
        reason: 'no-automation-in-v1',
      };
    },

    quote(productId: string, vehicle: Vehicle, dates: DateRange): Quote | null {
      const product = country.products.find((candidate) => candidate.id === productId);
      if (!product) return null;
      const verdict = coverage({ product, trip: dates, purchaseOn: todayISO(), channel: 'online' });
      return {
        productId,
        price: {
          amount: product.price.amount,
          currency: product.price.currency ?? country.currency,
        },
        validFrom: verdict.window.from,
        validTo: verdict.window.to,
        buyUrl: country.portal,
        source: product.source,
        verifiedAt: product.verifiedAt,
      };
    },

    async purchase(request: PurchaseRequest): Promise<PurchaseOutcome> {
      const product = country.products.find((candidate) => candidate.id === request.productId);
      return {
        outcome: 'manual',
        url: country.portal,
        prefill: {
          plate: request.vehicle.plate ?? '',
          product: product?.label.en ?? request.productId,
          validFrom: request.dates.from,
          registrationCountry: request.vehicle.registrationCountry ?? '',
        },
        instructions: `Buy this on ${country.portal}. Check the plate character by character before you pay — in ${code} a purchased product can normally only be corrected before its validity starts, if at all.`,
        reason: 'no-automation-in-v1',
      };
    },
  };
}
