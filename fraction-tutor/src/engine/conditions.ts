import type { FractionBar, Fraction, LessonCondition } from "./types";

/**
 * Extract the fraction a bar currently represents.
 * numerator = number of shaded segments
 * denominator = total segments
 */
export function barToFraction(bar: FractionBar): Fraction {
  return {
    numerator: bar.segments.filter((s) => s.shaded).length,
    denominator: bar.segments.length,
  };
}

/**
 * Check if two fractions are equivalent.
 * Uses cross-multiplication to avoid floating point issues.
 * a/b === c/d  ↔  a*d === b*c
 */
export function fractionsEqual(a: Fraction, b: Fraction): boolean {
  return a.numerator * b.denominator === b.numerator * a.denominator;
}

/**
 * Simplify a fraction to its lowest terms.
 */
export function simplify(f: Fraction): Fraction {
  if (f.numerator === 0) return { numerator: 0, denominator: 1 };
  const g = gcd(Math.abs(f.numerator), Math.abs(f.denominator));
  return { numerator: f.numerator / g, denominator: f.denominator / g };
}

function gcd(a: number, b: number): number {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Format a fraction for display: "1/2", "3/4", etc.
 */
export function fractionToString(f: Fraction): string {
  return `${f.numerator}/${f.denominator}`;
}

/**
 * Check if a lesson condition is met against the current bars.
 */
export function checkCondition(
  condition: LessonCondition,
  bars: FractionBar[]
): boolean {
  if (condition.type === "fraction_equals") {
    const bar = bars[condition.barIndex];
    if (!bar) return false;

    const current = barToFraction(bar);
    return fractionsEqual(current, condition.target);
  }
  return false;
}
