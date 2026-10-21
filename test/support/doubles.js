// doubles - neighbouring doubles, and a seeded random source, so a failure reproduces.
//
// INPUT_BINDING_SEED changes the seed of the tests' generated cases; the corpus generator passes its own.

const view = new DataView(new ArrayBuffer(8));

/** The least double greater than v. */
export function nextUp(v) {
	if (Number.isNaN(v) || v === Infinity) return v;
	if (v === 0) return Number.MIN_VALUE;
	view.setFloat64(0, v);
	const bits = view.getBigUint64(0);
	view.setBigUint64(0, v > 0 ? bits + 1n : bits - 1n);
	return view.getFloat64(0);
}

/** The greatest double less than v. */
export const nextDown = (v) => -nextUp(-v);

/** A seeded random source in [0, 1) (xorshift128+). */
export function seededRandom(seed = Number(process.env.INPUT_BINDING_SEED ?? 20261021)) {
	let s0 = BigInt(seed) | 1n, s1 = 0x9e3779b97f4a7c15n;
	const mask = (1n << 64n) - 1n;
	return () => {
		let x = s0;
		const y = s1;
		s0 = y;
		x = (x ^ (x << 23n)) & mask;
		s1 = x ^ y ^ (x >> 17n) ^ (y >> 26n);
		return Number(((s1 + y) & mask) >> 11n) / 2 ** 53;
	};
}

/** Helpers over a random source: integers, picks, booleans, shuffles. */
export function randomTools(rnd) {
	const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
	const pick = (list) => list[Math.floor(rnd() * list.length)];
	const chance = (p) => rnd() < p;
	const shuffle = (list) => {
		const out = [...list];
		for (let i = out.length - 1; i > 0; i--) {
			const j = Math.floor(rnd() * (i + 1));
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	};
	return { int, pick, chance, shuffle };
}
