// travel-oracle - the exact answer to IB10's travel question, sharing no code with the build's fallback.
//
// The build's fallback reads each binary64 value's bits as a significand and an exponent. This oracle
// never looks at bits: it makes each value an exact fraction n / 2^k by doubling it until it is an
// integer -- exact, since doubling a finite double below 2^1024 in magnitude never rounds, and a double
// that is not an integer is below 2^53 -- then puts the five over one power of two and compares
// (x1 - x0)^2 + (y1 - y0)^2 with t^2 in BigInt arithmetic.

/** A finite double as { n, k }: the value is n / 2^k exactly. */
export function exactFraction(v) {
	if (!Number.isFinite(v)) throw new RangeError(`travel-oracle: ${v} is not finite`);
	let w = v, k = 0;
	while (!Number.isInteger(w)) {
		w *= 2;
		k++;
	}
	return { n: BigInt(w), k };
}

/** True when the exact squared travel from (x0, y0) to (x1, y1) exceeds the exact square of t. */
export function oracleBeyond(x0, y0, x1, y1, t) {
	const f = [x0, y0, x1, y1, t].map(exactFraction);
	const k = Math.max(...f.map((g) => g.k));
	const [a, b, c, d, r] = f.map((g) => g.n << BigInt(k - g.k));
	return (c - a) ** 2n + (d - b) ** 2n > r ** 2n;
}

/** The sign of (exact squared travel - t^2): -1, 0 or 1. */
export function oracleCompare(x0, y0, x1, y1, t) {
	const f = [x0, y0, x1, y1, t].map(exactFraction);
	const k = Math.max(...f.map((g) => g.k));
	const [a, b, c, d, r] = f.map((g) => g.n << BigInt(k - g.k));
	const diff = (c - a) ** 2n + (d - b) ** 2n - r ** 2n;
	return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}
