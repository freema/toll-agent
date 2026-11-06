import { z } from 'zod';

/**
 * The data files are the product. Schema-validating them at load time means a
 * broken rule fails loudly on startup instead of quietly producing a wrong plan.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const comparison = z
  .object({
    lt: z.number().optional(),
    lte: z.number().optional(),
    gt: z.number().optional(),
    gte: z.number().optional(),
    in: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    not: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .strict();

const predicate = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), comparison]));

const localised = z.object({ en: z.string(), cs: z.string().optional() }).passthrough();

const validity = z.discriminatedUnion('type', [
  z.object({ type: z.literal('rolling-days'), days: z.number().int().positive() }),
  z.object({ type: z.literal('rolling-months'), months: z.number().int().positive() }),
  z.object({ type: z.literal('season'), from: isoDate, to: isoDate, year: z.number().int() }),
]);

const price = z.object({ amount: z.number().nonnegative(), currency: z.string().optional() });

const variant = z.object({
  when: predicate,
  price,
  note: z.string().optional(),
});

export const productSchema = z.object({
  id: z.string(),
  class: z.string(),
  kind: z.string(),
  label: localised,
  validity,
  price,
  variants: z.array(variant).optional(),
  online: z
    .object({
      validFromDays: z.number().int().nonnegative(),
      immediateChannels: z.array(z.string()).optional(),
    })
    .optional(),
  coverage: z.string().optional(),
  note: z.string().optional(),
  source: z.string().url(),
  verifiedAt: isoDate,
});

export const ruleSchema = z.object({
  id: z.string(),
  severity: z.enum(['info', 'warning', 'blocking']),
  text: localised,
  quote: z.string().optional(),
  when: predicate.optional(),
  effect: z.string(),
  source: z.string().url(),
  verifiedAt: isoDate,
  confidence: z.enum(['low', 'medium', 'high']).optional(),
});

export const countrySchema = z.object({
  country: z.string().length(2),
  name: localised,
  system: z.string(),
  currency: z.string(),
  portal: z.string().url(),
  checkUrl: z.string().url().optional(),
  scopeLimit: z.object({ maxWeightKg: z.number(), aboveLimit: z.string().url().optional() }),
  verifiedAt: isoDate,
  tollClasses: z.array(
    z.object({ id: z.string(), label: localised, when: predicate.optional() }),
  ),
  products: z.array(productSchema),
  sectionTolls: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        singleTripPrice: z.object({ amount: z.number(), class: z.string() }).optional(),
        hint: z.string().optional(),
        source: z.string().url(),
        verifiedAt: isoDate,
      }),
    )
    .optional(),
  purchase: z.object({
    advanceDays: z.number().int().nonnegative(),
    startsImmediately: z.boolean(),
    boundTo: z.string(),
    prepurchase: z.boolean().optional(),
    source: z.string().url(),
    verifiedAt: isoDate,
    confidence: z.enum(['low', 'medium', 'high']).optional(),
  }),
  rules: z.array(ruleSchema),
  gaps: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        severity: z.enum(['info', 'warning', 'blocking']),
      }),
    )
    .optional(),
});

export const portalsSchema = z.object({
  $comment: z.string().optional(),
  signpost: z.object({ name: z.string(), url: z.string().url(), verifiedAt: isoDate }),
  portals: z.array(
    z.object({
      country: z.string().length(2),
      operator: z.string(),
      shop: z.string().url(),
      checkUrl: z.string().url().optional(),
      openData: z.string().url().optional(),
      scope: z.array(z.string()),
      coverage: z.string().optional(),
      notes: z.string().optional(),
      verifiedAt: isoDate,
    }),
  ),
  fallbackMinistry: z.record(z.string(), z.string()).optional(),
});

export type CountryData = z.infer<typeof countrySchema>;
export type Product = z.infer<typeof productSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type PortalsData = z.infer<typeof portalsSchema>;
