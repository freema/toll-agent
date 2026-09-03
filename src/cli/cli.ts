#!/usr/bin/env node
import { parseArgs } from 'node:util';

import { loadCountry, loadPortals, isSupported } from '../data/load.js';
import { resolve } from '../rules/resolve.js';
import { adapterFor } from '../adapters/registry.js';
import { SUPPORTED_COUNTRIES, type CountryCode, type Vehicle } from '../types.js';
import type { Note, ResolveResult } from '../types.js';

const USAGE = `toll-agent — which European road tolls your trip needs, and where the official shop is.

Usage
  toll-agent plan --route CZ,AT,SI --from 2026-07-15 --to 2026-07-25 [options]
  toll-agent portals [COUNTRY]
  toll-agent rules COUNTRY
  toll-agent check COUNTRY PLATE
  toll-agent mcp                            Start the MCP server on stdio.

Options for "plan"
  --route         Comma-separated country codes (${SUPPORTED_COUNTRIES.join(', ')}).
  --from, --to    Trip dates, YYYY-MM-DD, inclusive.
  --vehicle       car | motorcycle          (default: car)
  --weight        Maximum laden mass in kg  (default: 2000)
  --front-height  Height above the FIRST axle in m. Slovenia splits 2A/2B at 1.3.
  --height        Total height in m, roof box included. Croatia splits at 1.9.
  --powertrain    petrol|diesel|hybrid|phev|bev|hydrogen|cng|lng|biomethane
  --co2           g CO2/km, for the Czech reduced rates.
  --plate         Licence plate, exactly as written on it.
  --trailer       Trailer maximum laden mass in kg.
  --buy-on        Purchase date, YYYY-MM-DD (default: today). Drives Austria's 18-day rule.
  --channel       online | retail (default: online)
  --json          Machine-readable output.

This tool never buys anything and never touches a payment. It tells you what you
need and links the official state e-shop. Nothing else.`;

const ICON: Record<Note['severity'], string> = { info: 'i', warning: '!', blocking: 'X' };

function printNotes(notes: Note[], indent = '    '): void {
  for (const note of notes) {
    console.log(`${indent}[${ICON[note.severity]}] ${note.text}`);
    if (note.source) console.log(`${indent}    source: ${note.source}${note.verifiedAt ? ` (verified ${note.verifiedAt})` : ''}`);
  }
}

function money(amount: number, currency: string): string {
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;
}

function printPlan(result: ResolveResult): void {
  const { input } = result;
  console.log(`\ntoll-agent — ${input.route.join(' -> ')}, ${input.dates.from} to ${input.dates.to}`);
  console.log(`vehicle: ${input.vehicle.category}, ${input.vehicle.maxWeightKg} kg${input.vehicle.plate ? `, plate ${input.vehicle.plate}` : ''}`);
  console.log('');

  for (const requirement of result.requirements) {
    switch (requirement.kind) {
      case 'vignette': {
        console.log(`${requirement.country}  vignette — class ${requirement.tollClass} (${requirement.tollClassLabel})`);
        for (const option of requirement.options) {
          const mark = option.productId === requirement.recommended ? '=>' : option.coversTrip ? ' -' : ' x';
          console.log(
            `  ${mark} ${option.label.padEnd(26)} ${money(option.price.amount, option.price.currency).padStart(12)}   valid ${option.validFrom} .. ${option.validTo}`,
          );
          if (option.reason) console.log(`       ${option.reason}`);
          for (const note of option.notes) console.log(`       ${note}`);
        }
        console.log(`  buy at: ${requirement.buyUrl}`);
        if (requirement.checkUrl) console.log(`  check a plate: ${requirement.checkUrl}`);
        printNotes(requirement.notes, '  ');
        break;
      }
      case 'section-toll': {
        console.log(`${requirement.country}  section tolls (not covered by any vignette)`);
        for (const toll of requirement.tolls) {
          console.log(
            `   - ${toll.name.padEnd(30)} ${toll.price ? money(toll.price.amount, toll.price.currency) : 'price unknown'}${toll.hint ? `   ${toll.hint}` : ''}`,
          );
        }
        printNotes(requirement.notes, '  ');
        break;
      }
      case 'pay-on-site':
        console.log(`${requirement.country}  pay on site — nothing to buy in advance`);
        printNotes(requirement.notes, '  ');
        console.log(`  info: ${requirement.buyUrl}`);
        break;
      case 'not-required':
        console.log(`${requirement.country}  nothing to pay`);
        printNotes(requirement.notes, '  ');
        break;
      case 'needs-input':
        console.log(`${requirement.country}  needs more input: ${requirement.missing.join(', ')}`);
        printNotes(requirement.notes, '  ');
        break;
      case 'out-of-scope':
        console.log(`${requirement.country}  out of scope`);
        printNotes(requirement.notes, '  ');
        if (requirement.seeAlso) console.log(`  see: ${requirement.seeAlso}`);
        break;
      case 'unsupported':
        console.log(`${requirement.country}  not modelled in v1`);
        printNotes(requirement.notes, '  ');
        break;
    }
    console.log('');
  }

  if (result.estimatedTotal.length > 0) {
    console.log(`estimated total for the recommended options: ${result.estimatedTotal.map((total) => money(total.amount, total.currency)).join(' + ')}`);
  }
  if (result.warnings.length > 0) {
    console.log('');
    printNotes(result.warnings, '');
  }
  console.log('\nEverything above is a recommendation from verified data, not a guarantee.');
  console.log('The plate and the vehicle class are yours to get right — exactly as on the state portals.\n');
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(USAGE);
    return 0;
  }

  if (command === 'mcp') {
    // The MCP server takes over stdio from here; nothing else may write to it.
    await import('../mcp/server.js');
    return new Promise<number>(() => {});
  }

  if (command === 'portals') {
    const [country] = rest;
    const portals = loadPortals();
    if (country) {
      const portal = portals.portals.find((entry) => entry.country === country.toUpperCase());
      if (!portal) {
        console.log(`No verified official portal for ${country.toUpperCase()} in our data.`);
        console.log('We would rather leave a gap than send you to a reseller. Check that country\'s ministry of transport.');
        return 1;
      }
      console.log(`${portal.country}  ${portal.operator}\n  shop:  ${portal.shop}${portal.checkUrl ? `\n  check: ${portal.checkUrl}` : ''}\n  scope: ${portal.scope.join(', ')}\n  ${portal.notes ?? ''}\n  verified ${portal.verifiedAt}`);
      return 0;
    }
    console.log(`\nOfficial portals (source: ${portals.signpost.url}, verified ${portals.signpost.verifiedAt})\n`);
    for (const portal of portals.portals) {
      console.log(`  ${portal.country}  ${portal.shop.padEnd(32)} ${portal.operator}`);
    }
    console.log('\nThese are the only URLs this tool will ever send you to.\n');
    return 0;
  }

  if (command === 'rules') {
    const [country] = rest;
    if (!country || !isSupported(country.toUpperCase())) {
      console.error(`Usage: toll-agent rules ${SUPPORTED_COUNTRIES.join('|')}`);
      return 1;
    }
    console.log(JSON.stringify(loadCountry(country.toUpperCase() as never), null, 2));
    return 0;
  }

  if (command === 'check') {
    const [country, plate] = rest;
    if (!country || !plate || !isSupported(country.toUpperCase())) {
      console.error('Usage: toll-agent check COUNTRY PLATE');
      return 1;
    }
    const outcome = await adapterFor(country.toUpperCase() as never).check({ plate });
    console.log(JSON.stringify(outcome, null, 2));
    return 0;
  }

  if (command !== 'plan') {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    return 1;
  }

  const { values } = parseArgs({
    args: rest,
    options: {
      route: { type: 'string' },
      from: { type: 'string' },
      to: { type: 'string' },
      vehicle: { type: 'string', default: 'car' },
      weight: { type: 'string', default: '2000' },
      'front-height': { type: 'string' },
      height: { type: 'string' },
      powertrain: { type: 'string' },
      co2: { type: 'string' },
      plate: { type: 'string' },
      trailer: { type: 'string' },
      'buy-on': { type: 'string' },
      channel: { type: 'string', default: 'online' },
      json: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (!values.route || !values.from || !values.to) {
    console.error('plan needs --route, --from and --to.\n');
    console.log(USAGE);
    return 1;
  }

  const vehicle: Vehicle = {
    category: values.vehicle === 'motorcycle' ? 'motorcycle' : 'car',
    maxWeightKg: Number(values.weight),
    ...(values['front-height'] ? { heightAboveFrontAxleM: Number(values['front-height']) } : {}),
    ...(values.height ? { totalHeightM: Number(values.height) } : {}),
    ...(values.powertrain ? { powertrain: values.powertrain as Vehicle['powertrain'] } : {}),
    ...(values.co2 ? { co2GramsPerKm: Number(values.co2) } : {}),
    ...(values.plate ? { plate: values.plate } : {}),
    ...(values.trailer ? { trailer: { maxWeightKg: Number(values.trailer) } } : {}),
  };

  const result = resolve({
    route: values.route.split(',').map((code) => code.trim().toUpperCase() as CountryCode),
    vehicle,
    dates: { from: values.from, to: values.to },
    purchase: {
      ...(values['buy-on'] ? { on: values['buy-on'] } : {}),
      channel: values.channel === 'retail' ? 'retail' : 'online',
    },
  });

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printPlan(result);
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
