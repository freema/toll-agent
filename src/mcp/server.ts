#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { loadCountry, loadPortals, isSupported, officialHosts } from '../data/load.js';
import { resolve } from '../rules/resolve.js';
import { adapterFor } from '../adapters/registry.js';
import { SUPPORTED_COUNTRIES, LISTED_COUNTRIES, type CountryCode } from '../types.js';

const countryEnum = z.enum([...SUPPORTED_COUNTRIES, ...LISTED_COUNTRIES]);

const vehicleShape = z.object({
  category: z.enum(['car', 'motorcycle']).default('car'),
  maxWeightKg: z.number().positive().describe('Technically permissible maximum laden mass in kg.'),
  heightAboveFrontAxleM: z
    .number()
    .positive()
    .optional()
    .describe('Height above the FIRST axle in metres. Slovenia splits class 2A/2B at 1.3 m.'),
  totalHeightM: z
    .number()
    .positive()
    .optional()
    .describe('Total vehicle height in metres, roof box included. Croatia splits its class at 1.9 m.'),
  powertrain: z
    .enum(['petrol', 'diesel', 'hybrid', 'phev', 'bev', 'hydrogen', 'cng', 'lng', 'biomethane'])
    .optional(),
  co2GramsPerKm: z.number().nonnegative().optional(),
  plate: z.string().optional().describe('Licence plate exactly as written on the plate.'),
  registrationCountry: z.string().length(2).optional(),
  trailer: z.object({ maxWeightKg: z.number().positive() }).optional(),
});

const server = new McpServer(
  { name: 'toll-agent', version: '0.1.0' },
  {
    instructions:
      'Answers which European road tolls a trip needs and where the official state e-shop is. ' +
      'Never invent a rule, a price or a shop URL: everything comes from toll_resolve, toll_country_rules ' +
      'and toll_portals, each of which carries a source URL and a verification date. ' +
      'If a country is not covered, say so and link its official portal rather than guessing. ' +
      'This server never pays for anything.',
  },
);

server.registerTool(
  'toll_resolve',
  {
    title: 'Resolve tolls for a trip',
    description:
      'Given the countries a trip crosses, the vehicle and the dates, returns what has to be paid, ' +
      'which product covers the trip, what it costs, and what has to be paid on the spot. ' +
      'Deterministic and offline — it reads verified data files, not the web.',
    inputSchema: {
      route: z.array(countryEnum).min(1).describe('Countries crossed, in any order.'),
      vehicle: vehicleShape,
      from: z.string().describe('First day of the trip, YYYY-MM-DD.'),
      to: z.string().describe('Last day of the trip, YYYY-MM-DD.'),
      purchaseOn: z.string().optional().describe('Day of purchase, YYYY-MM-DD. Defaults to today.'),
      purchaseChannel: z
        .enum(['online', 'retail'])
        .optional()
        .describe(
          "How it would be bought. 'retail' means a petrol station or motoring club counter, " +
            "which in Austria escapes the 18-day online rule.",
        ),
    },
  },
  async ({ route, vehicle, from, to, purchaseOn, purchaseChannel }) => {
    const result = resolve({
      route: route as CountryCode[],
      vehicle,
      dates: { from, to },
      purchase: { ...(purchaseOn ? { on: purchaseOn } : {}), channel: purchaseChannel ?? 'online' },
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  },
);

server.registerTool(
  'toll_portals',
  {
    title: 'Official toll portals',
    description:
      'The allowlist of official state e-shops, one per country, with operator and verification date. ' +
      'This is the only list of URLs a user may be sent to. Resellers with a 20-30% markup are the ' +
      'reason this project exists; never link one.',
    inputSchema: { country: countryEnum.optional() },
  },
  async ({ country }) => {
    const portals = loadPortals();
    const payload = country
      ? (portals.portals.find((portal) => portal.country === country) ?? {
          country,
          note: 'No verified official portal in our data. Point the user at that country\'s ministry of transport rather than at any shop.',
        })
      : { signpost: portals.signpost, portals: portals.portals, officialHosts: officialHosts() };
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  },
);

server.registerTool(
  'toll_country_rules',
  {
    title: 'Rules and products for one country',
    description:
      'The raw verified rule set for a country: toll classes, products with prices, and the traps ' +
      "(Austria's 18-day online rule, Slovenia's height above the front axle, Hungary's 10-day 'weekly', " +
      'Croatia having no vignette at all). Each entry carries its source and the date it was verified.',
    inputSchema: { country: countryEnum },
  },
  async ({ country }) => {
    if (!isSupported(country)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              country,
              modelled: false,
              message: `${country} is listed but not modelled in v1. We do not guess its rules.`,
            }),
          },
        ],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(loadCountry(country), null, 2) }],
    };
  },
);

server.registerTool(
  'toll_check',
  {
    title: 'Check what a plate already has',
    description:
      'Asks the official portal what is already valid for a licence plate. In v1 no portal is ' +
      'automated, so this returns a manual handoff: the official check URL and the plate to type in. ' +
      'Never report a vignette as valid on the strength of this tool alone unless the outcome is "ok".',
    inputSchema: {
      country: countryEnum,
      plate: z.string(),
      registrationCountry: z.string().length(2).optional(),
    },
  },
  async ({ country, plate, registrationCountry }) => {
    if (!isSupported(country)) {
      return {
        content: [
          { type: 'text', text: JSON.stringify({ outcome: 'unsupported', country, plate }) },
        ],
      };
    }
    const outcome = await adapterFor(country).check({
      plate,
      ...(registrationCountry ? { registrationCountry } : {}),
    });
    return { content: [{ type: 'text', text: JSON.stringify(outcome, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
