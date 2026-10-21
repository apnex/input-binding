// travel-cases - travels for IB10's tests (I9): a random sweep across magnitudes, travels targeted within a
// few binary64 steps of the threshold at any origin, and cases built so the binary64 filter cannot decide
// them -- exact equality and one step either side, across exponents, from negative and distant origins.
// Each case is [x0, y0, x1, y1, t].
import { nextDown, nextUp, randomTools } from "./doubles.js";

const MAX = Number.MAX_VALUE, MIN = Number.MIN_VALUE, SMALLEST_NORMAL = 2 ** -1022;

/** One coordinate of the sweep: ordinary, huge, tiny, subnormal or zero, as the third reading's prototype draws them. */
function sweepValue(rnd) {
	const r = rnd();
	if (r < 0.1) return (rnd() - 0.5) * 1e308 * 1.7;
	if (r < 0.2) return (rnd() - 0.5) * 1e-300;
	if (r < 0.25) return MIN * Math.floor(rnd() * 10);
	if (r < 0.3) return 0;
	return (rnd() - 0.5) * 2000;
}

/** The random sweep: a tenth huge, a tenth tiny, a twentieth subnormal, a twentieth zero; half the travels within 10^-14 of their threshold. */
export function sweepCases(rnd, count) {
	const out = [];
	while (out.length < count) {
		const x0 = sweepValue(rnd), y0 = sweepValue(rnd);
		let x1, y1, t;
		if (rnd() < 0.5) {
			t = Math.abs(sweepValue(rnd));
			const theta = rnd() * 7, r = t * (1 + (rnd() - 0.5) * 1e-14);
			x1 = x0 + r * Math.cos(theta);
			y1 = y0 + r * Math.sin(theta);
		} else {
			x1 = sweepValue(rnd);
			y1 = sweepValue(rnd);
			t = Math.abs(sweepValue(rnd));
		}
		if ([x1, y1].every(Number.isFinite)) out.push([x0, y0, x1, y1, t]);
	}
	return out;
}

/**
 * Travels targeted within a few binary64 steps of their threshold, on both sides, near the origin and
 * far from it: the move is drawn first, the threshold set to Math.hypot of the differences -- within a
 * step or so of the exact distance -- and then moved up to three steps either way.
 */
export function targetedCases(rnd, count) {
	const { int, pick } = randomTools(rnd);
	const out = [];
	while (out.length < count) {
		const far = pick([0, 1, 1e3, 1e6, 1e12, 2 ** 52, 1e100, 1e300]);
		const x0 = (rnd() - 0.5) * 2 * far, y0 = (rnd() - 0.5) * 2 * far;
		const scale = pick([4, 1, 1e-3, 1e-200, 1e200, (rnd() + 0.01) * 10 ** int(-300, 300)]);
		const theta = rnd() * 2 * Math.PI;
		const x1 = x0 + scale * Math.cos(theta), y1 = y0 + scale * Math.sin(theta);
		let t = Math.hypot(x1 - x0, y1 - y0);
		if (!Number.isFinite(t) || !Number.isFinite(x1) || !Number.isFinite(y1)) continue;
		for (let k = int(-3, 3); k !== 0; k += k > 0 ? -1 : 1) t = k > 0 ? nextUp(t) : Math.max(0, nextDown(t));
		out.push([x0, y0, x1, y1, t]);
	}
	return out;
}

/**
 * Cases built so the filter cannot decide them, as the third reading's prototype builds them: for five
 * Pythagorean triples scaled by every seventh power of two from subnormal to overflow, exact equality
 * and one binary64 step either side, from the origin, from negative and from distant origins, with a
 * sign that matters; and the extremes -- opposite-sign values near Number.MAX_VALUE against one at
 * Number.MIN_VALUE, squares that underflow, signed zeros.
 */
export function forcedCases() {
	const forced = [];
	const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [20, 21, 29], [119, 120, 169]];
	const exact = (v, base, times) => Number.isFinite(v) && v !== 0 && v / base === times;
	for (let k = -1074; k <= 1015; k += 7) {
		for (const [a, b, c] of triples) {
			const p = 2 ** k;
			const T = c * p, X = a * p, Y = b * p;
			if (!exact(T, p, c) || !exact(X, p, a) || !exact(Y, p, b)) continue;
			forced.push([0, 0, X, Y, T]);
			forced.push([-X, -Y, 0, 0, T]);
			forced.push([0, 0, X, Y, nextDown(T)]);
			forced.push([0, 0, X, Y, nextUp(T)]);
			forced.push([0, 0, nextUp(X), Y, T]);
			forced.push([0, 0, nextDown(X), Y, T]);
			forced.push([-p, 0, (a - 1) * p, Y, nextDown(T)]);
			forced.push([0, -Y, -X, 0, T]);
			forced.push([X, -Y, 0, 0, nextUp(T)]);
			const ox = 1024 * X, oy = -2048 * Y;
			if (exact(ox, X, 1024) && exact(oy, Y, -2048) && exact(ox + X, X, 1025) && exact(oy + Y, Y, -2047)) {
				forced.push([ox, oy, ox + X, oy + Y, T]);
				forced.push([ox, oy, ox + X, oy + Y, nextDown(T)]);
			}
		}
	}
	forced.push(
		[MAX, MIN, -MAX, 0, MAX],
		[MAX, 0, -MAX, 0, MAX],
		[-MAX, 0, MAX, 0, MAX],
		[0, 0, MIN, 0, 0],
		[0, 0, MIN, 0, MIN],
		[0, 0, MIN, MIN, MIN],
		[-0, 0, 0, -0, 0],
		[0, 0, 0, 0, 0],
		[0, 0, SMALLEST_NORMAL, 0, nextDown(SMALLEST_NORMAL)],
		[0, 0, nextDown(SMALLEST_NORMAL), 0, SMALLEST_NORMAL],
		[MIN, 0, SMALLEST_NORMAL, 0, SMALLEST_NORMAL - MIN],
		[0, 0, SMALLEST_NORMAL, 0, SMALLEST_NORMAL],
		[4, 0, 0, 0, 4],
		[0, 0, 4, 0, 4],
		[-1, 0, 2, 4, nextDown(5)],
		[0, 5e-324, 4, 1e-323, 4],
		[-5e-324, 5e-324, 4, -8.673617379884035e-19, 4],
	);
	return forced;
}
