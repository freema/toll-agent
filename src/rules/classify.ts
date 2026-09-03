import { match } from '../data/predicate.js';
import type { CountryData } from '../data/schema.js';
import type { Vehicle } from '../types.js';

/**
 * Flattens a vehicle into the fields data files are allowed to match on.
 * Anything not listed here is invisible to the rules, on purpose.
 */
export function vehicleFacts(vehicle: Vehicle, asTrailer = false): Record<string, unknown> {
  if (asTrailer) {
    return {
      isTrailer: true,
      category: 'trailer',
      maxWeightKg: vehicle.trailer?.maxWeightKg,
      combinationWeightKg: vehicle.maxWeightKg + (vehicle.trailer?.maxWeightKg ?? 0),
    };
  }
  return {
    isTrailer: false,
    category: vehicle.category,
    maxWeightKg: vehicle.maxWeightKg,
    heightAboveFrontAxleM: vehicle.heightAboveFrontAxleM,
    totalHeightM: vehicle.totalHeightM,
    powertrain: vehicle.powertrain,
    co2GramsPerKm: vehicle.co2GramsPerKm,
    combinationWeightKg: vehicle.maxWeightKg + (vehicle.trailer?.maxWeightKg ?? 0),
    registrationCountry: vehicle.registrationCountry,
  };
}

export type Classification =
  | { kind: 'matched'; classId: string; label: string }
  | { kind: 'needs-input'; missing: string[] }
  | { kind: 'no-class' };

/**
 * First class whose predicate holds wins. If no class matches outright but one
 * could not be decided for want of a dimension, we ask for that dimension
 * instead of picking a class — an unasked question is cheaper than the wrong
 * toll class.
 */
export function classify(country: CountryData, vehicle: Vehicle, asTrailer = false): Classification {
  const facts = vehicleFacts(vehicle, asTrailer);
  const missing = new Set<string>();

  for (const tollClass of country.tollClasses) {
    const outcome = match(tollClass.when, facts);
    if (outcome.result === 'yes') {
      return { kind: 'matched', classId: tollClass.id, label: tollClass.label.en };
    }
    if (outcome.result === 'unknown') {
      for (const field of outcome.missing) missing.add(field);
    }
  }

  if (missing.size > 0) return { kind: 'needs-input', missing: [...missing] };
  return { kind: 'no-class' };
}
