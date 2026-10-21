/**
 * Whether a press has travelled beyond the threshold, decided exactly (CONTRACT.md, IB10; the design's D7).
 *
 * With (x0, y0) the press's origin, (x1, y1) a move's point and t the threshold, the press is beyond when
 * (x1 - x0)^2 + (y1 - y0)^2 > t^2 holds of the exact real numbers the binary64 values denote; a travel of
 * exactly the threshold is not beyond. It is computed in two steps:
 *
 * 1. A binary64 filter. With dx, dy, s = dx * dx + dy * dy and q = t * t each rounded once, all four
 *    finite, and each of dx * dx, dy * dy and q either 0 because its operand is 0 or at least 2^-1022:
 *    beyond when s > q * (1 + 2^-49), not beyond when s < q * (1 - 2^-49). A subtraction whose result is
 *    subnormal is exact, and otherwise errs by at most one rounding, u = 2^-53 relative; so with no
 *    underflow the computed s lies within a factor 1 +- 5u of the exact sum and q within 1 +- u of t^2,
 *    and the margin 2^-49 = 16u absorbs both and the one rounding that forms each bound.
 * 2. An exact fallback, for every travel the filter leaves: the five values read as their exact
 *    significands and exponents, shifted as BigInts to the least exponent among the nonzero ones, and
 *    compared exactly. The exponents of the last places of finite binary64 values run from -1074 to 971,
 *    so each shifted operand has at most 2,098 bits and each square 4,198.
 */

const SMALLEST_NORMAL = 2 ** -1022;
const FILTER_ABOVE = 1 + 2 ** -49;
const FILTER_BELOW = 1 - 2 ** -49;

/** A finite binary64 value as an exact integer significand and an exponent: the value is significand * 2^exponent. */
interface ExactBinary64 {
	readonly significand: bigint;
	readonly exponent: number;
}

/** A square formed in binary64 is free of underflow: 0 because its operand is 0, or at least the smallest normal number. */
const squareClearOfUnderflow = (square: number, operand: number): boolean => (operand === 0 ? square === 0 : square >= SMALLEST_NORMAL);

/** Step 1, the binary64 filter: true or false when it decides the travel, undefined when it leaves it to the fallback. */
export function filterTravelBeyond(x0: number, y0: number, x1: number, y1: number, threshold: number): boolean | undefined {
	const dx = x1 - x0;
	const dy = y1 - y0;
	const dxSquared = dx * dx;
	const dySquared = dy * dy;
	const s = dxSquared + dySquared;
	const q = threshold * threshold;
	if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(s) || !Number.isFinite(q)) return undefined;
	if (!squareClearOfUnderflow(dxSquared, dx) || !squareClearOfUnderflow(dySquared, dy) || !squareClearOfUnderflow(q, threshold)) return undefined;
	if (s > q * FILTER_ABOVE) return true;
	if (s < q * FILTER_BELOW) return false;
	return undefined;
}

/** Reads a finite binary64 value's bits as its exact significand, signed, and the exponent of its last place. */
function exactBinary64(value: number): ExactBinary64 {
	const bits = new DataView(new ArrayBuffer(8));
	bits.setFloat64(0, value);
	const high = bits.getUint32(0);
	const low = bits.getUint32(4);
	const biasedExponent = (high >>> 20) & 0x7ff;
	let magnitude = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
	let exponent: number;
	if (biasedExponent === 0) {
		// a subnormal or a zero has no hidden bit
		exponent = -1074;
	} else {
		magnitude |= 1n << 52n;
		exponent = biasedExponent - 1075;
	}
	const significand = high >>> 31 === 1 ? -magnitude : magnitude;
	return { significand, exponent };
}

/** Step 2, the exact fallback: the comparison made on the values' exact significands, shifted to their least exponent. */
export function exactTravelBeyond(x0: number, y0: number, x1: number, y1: number, threshold: number): boolean {
	const parts = [x0, y0, x1, y1, threshold].map(exactBinary64);
	const exponents = parts.filter((part) => part.significand !== 0n).map((part) => part.exponent);
	// every value zero: a travel of 0 is not beyond a threshold of 0
	if (exponents.length === 0) return false;
	const leastExponent = Math.min(...exponents);
	const [ox, oy, mx, my, t] = parts.map((part) => part.significand << BigInt(part.exponent - leastExponent)) as [bigint, bigint, bigint, bigint, bigint];
	const dx = mx - ox;
	const dy = my - oy;
	const squaredTravel = dx * dx + dy * dy;
	const squaredThreshold = t * t;
	return squaredTravel > squaredThreshold;
}

/** IB10: whether a travel from (x0, y0) to (x1, y1) lies beyond the threshold -- the filter where it decides, the fallback otherwise. */
export function travelBeyond(x0: number, y0: number, x1: number, y1: number, threshold: number): boolean {
	const decided = filterTravelBeyond(x0, y0, x1, y1, threshold);
	return decided === undefined ? exactTravelBeyond(x0, y0, x1, y1, threshold) : decided;
}
