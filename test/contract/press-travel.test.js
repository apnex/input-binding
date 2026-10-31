// press-travel - IB10 (I9): whether a press has travelled beyond the threshold, decided exactly from its
// moves, and whether its release is a click or a drop -- held to an exact oracle that shares no code with
// the build's fallback, over generated streams, targeted travels, extremes, and cases built so the
// binary64 filter cannot decide them, which mutations of the fallback each fail.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { scratchFolder } from "@apnex/clean-runner";

import { openGestureSession } from "@apnex/input-binding";
import { nextDown, nextUp, randomTools, seededRandom } from "../support/doubles.js";
import { applyToSession, initialModel, modelOf, modelStep } from "../support/lifecycle-model.js";
import { forcedCases, sweepCases, targetedCases } from "../support/travel-cases.js";
import { oracleBeyond } from "../support/travel-oracle.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const builtTravel = path.join(here, "..", "..", "dist", "travel-beyond.js");
// the build's own module, imported by path: the package exports only its two functions
const { exactTravelBeyond, filterTravelBeyond, travelBeyond } = await import(pathToFileURL(builtTravel).href);

const session = (threshold = 4, gestures = []) => openGestureSession({ threshold, gestures }).session;
const down = (s, x, y, button = 0) => s.pointerDown({ at: { x, y }, button });
const move = (s, x, y) => s.pointerMove({ at: { x, y } });

test("IB10: a travel of exactly the threshold is a click; one binary64 step beyond it is a drop", () => {
	for (const [x, y, t] of [[4, 0, 4], [0, -4, 4], [3, 4, 5], [-3, -4, 5], [1.5, 2, 2.5], [0, 0, 0]]) {
		const s = session(t);
		down(s, 0, 0);
		assert.equal(move(s, x, y).crossed, false, `(${x}, ${y}) against ${t}`);
		assert.equal(s.state.press.beyond, false);
		assert.equal(s.pointerUp({ button: 0 }).trigger, "click");
		down(s, 0, 0);
		const beyond = x !== 0 ? [nextUp(Math.abs(x)) * Math.sign(x), y] : [x, y === 0 ? Number.MIN_VALUE : nextUp(Math.abs(y)) * Math.sign(y)];
		assert.equal(move(s, ...beyond).crossed, true, `one step beyond (${beyond}) against ${t}`);
		assert.equal(s.pointerUp({ button: 0 }).trigger, "drop");
	}
	const s = session(4);
	down(s, 10, 10);
	assert.equal(move(s, nextDown(14), 10).crossed, false);
	assert.equal(move(s, 14, 10).crossed, false);
	assert.equal(move(s, nextUp(14), 10).crossed, true, "from 10, one step beyond 14 is beyond 4");
});

test("IB10: a move with no press changes no press; crossed falls once; a press never stops being beyond but by a new press, a restart, a release or a lost pointer", () => {
	const s = session(4, [{ name: "g", engaged: true, button: null }]);
	const before = s.state;
	const lone = move(s, 100, 100);
	assert.equal(lone.crossed, false);
	assert.equal(lone.state, before, "the very same state");
	down(s, 0, 0);
	assert.equal(move(s, 5, 0).crossed, true);
	assert.equal(move(s, 6, 0).crossed, false, "already beyond");
	assert.equal(move(s, 0, 0).crossed, false);
	assert.equal(s.state.press.beyond, true, "back at the origin, still beyond");
	assert.equal(s.pointerUp({ button: 0 }).trigger, "drop", "the furthest travel counts, not where the pointer ended");
	assert.equal(s.state.press, null);
	assert.equal(s.pointerUp({ button: 0 }).trigger, "click", "a release with no press is a click");
	down(s, 0, 0);
	move(s, 5, 0);
	assert.equal(s.pointerLost().state.press, null);
	down(s, 0, 0);
	move(s, 5, 0);
	down(s, 50, 50);
	assert.deepEqual(s.state.press, { at: { x: 50, y: 50 }, beyond: false, unmatched: true, button: 0, pointer: null }, "a second press replaces the first, whatever it was");
	move(s, 55, 50);
	s.startGesture({ gesture: "g", from: { x: 100, y: 100 } });
	assert.deepEqual(s.state.press, { at: { x: 100, y: 100 }, beyond: false, unmatched: true, button: 0, pointer: null }, "a restart from `from`, not beyond, unmatched, its button and its pointer kept");
	assert.equal(move(s, 103, 100).crossed, false);
	assert.equal(move(s, 105, 100).crossed, true, "measured from the restart");
});

test("IB10: a restart with no press held reads and checks `from`, and changes nothing", () => {
	const s = session(4, [{ name: "g", engaged: true, button: null }, { name: "h", engaged: false, button: null }]);
	s.startGesture({ gesture: "g", from: { x: 1, y: 2 } });
	assert.equal(s.state.press, null);
	assert.throws(() => s.becomeGesture({ gesture: "h", from: { x: NaN, y: 0 } }), (e) => e instanceof TypeError && e.message.startsWith("becomeGesture:"));
	assert.equal(s.becomeGesture({ gesture: "h", from: { x: 3, y: 4 } }).state.press, null);
	down(s, 0, 0);
	s.becomeGesture({ gesture: "g", from: { x: -0, y: 7 } });
	assert.ok(Object.is(s.state.press.at.x, 0), "-0 written 0");
	assert.equal(s.state.press.unmatched, true);
});

test("IB10: a release's position never counts -- pointerUp reads its button, never its at", () => {
	for (const at of [{ x: 0, y: 0 }, { x: 1e9, y: 1e9 }, undefined]) {
		const s = session(4);
		down(s, 0, 0);
		move(s, 3, 0);
		const fact = { button: 0 };
		if (at !== undefined) fact.at = at;
		else Object.defineProperty(fact, "at", { get: () => assert.fail("pointerUp read at"), enumerable: true });
		assert.equal(s.pointerUp(fact).trigger, "click");
	}
	const s = session(4);
	down(s, 0, 0);
	move(s, 5, 0);
	assert.equal(s.pointerUp({ button: 0, at: { x: 0, y: 0 } }).trigger, "drop", "released at its origin, still a drop");
});

test("IB10: the filter decides an ordinary travel, and the fallback decides at the edge and at extremes", () => {
	assert.equal(filterTravelBeyond(0, 0, 5, 0, 4), true);
	assert.equal(filterTravelBeyond(0, 0, 3, 0, 4), false);
	assert.equal(filterTravelBeyond(100, -20, 103, -16, 4.5), true);
	assert.equal(filterTravelBeyond(0, 0, 4, 0, 4), undefined, "exact equality is left to the fallback");
	assert.equal(filterTravelBeyond(0, 0, nextUp(4), 0, 4), undefined, "one step beyond lies within the filter's margin");
	assert.equal(filterTravelBeyond(Number.MAX_VALUE, 0, -Number.MAX_VALUE, 0, 1), undefined, "a difference that overflows");
	assert.equal(filterTravelBeyond(0, 0, 1e-200, 0, 1e-200), undefined, "a square that underflows");
	assert.equal(filterTravelBeyond(0, 0, 0, 0, 0), undefined, "every square 0, and 0 < 0 false: left to the fallback");
	assert.equal(filterTravelBeyond(0, 0, 1, 0, 0), true, "a threshold of 0 squared is 0 because its operand is 0");
	assert.equal(travelBeyond(0, 0, 4, 0, 4), false);
	assert.equal(travelBeyond(0, 0, nextUp(4), 0, 4), true);
	assert.equal(travelBeyond(Number.MAX_VALUE, 0, -Number.MAX_VALUE, 0, Number.MAX_VALUE), true);
	assert.equal(travelBeyond(0, 0, 1e-200, 0, 1e-200), false);
	assert.equal(travelBeyond(0, 0, nextUp(1e-200), 0, 1e-200), true);
});

test("I9: the filter is sound and the fallback exact -- every random travel agrees with the oracle, many through the fallback", () => {
	const rnd = seededRandom();
	let viaFallback = 0, wrongFilter = 0, wrong = 0;
	for (const c of sweepCases(rnd, 60000)) {
		const truth = oracleBeyond(...c);
		const filtered = filterTravelBeyond(...c);
		if (filtered === undefined) viaFallback++;
		else if (filtered !== truth) wrongFilter++;
		if (exactTravelBeyond(...c) !== truth || travelBeyond(...c) !== truth) wrong++;
	}
	assert.equal(wrongFilter, 0, "the filter never decides wrongly");
	assert.equal(wrong, 0);
	assert.ok(viaFallback > 10000, `${viaFallback} travels reached the fallback`);
});

test("I9: travels targeted within a few binary64 steps of the threshold, on both signs, near the origin and far from it", () => {
	const rnd = seededRandom();
	let above = 0, below = 0, equal = 0, viaFallback = 0;
	for (const c of targetedCases(rnd, 30000)) {
		const truth = oracleBeyond(...c);
		assert.equal(travelBeyond(...c), truth, JSON.stringify(c));
		if (filterTravelBeyond(...c) === undefined) viaFallback++;
		const [x0, y0, x1, y1, t] = c;
		const back = oracleBeyond(x0, y0, x1, y1, t) === oracleBeyond(x1, y1, x0, y0, t);
		assert.ok(back, "the same travel backwards");
		if (truth) above++;
		else if (oracleBeyond(x0, y0, x1, y1, nextDown(t)) || t === 0) equal++;
		else below++;
	}
	assert.ok(above > 5000 && below > 5000 && viaFallback > 20000, `${above} beyond, ${below} within, ${equal} at exactly the threshold, ${viaFallback} through the fallback`);
});

test("I9: every case built so the filter cannot decide it reaches the fallback, and agrees with the oracle", () => {
	const forced = forcedCases();
	assert.ok(forced.length > 2500, `${forced.length} built cases`);
	for (const c of forced) {
		assert.equal(filterTravelBeyond(...c), undefined, `the filter leaves ${JSON.stringify(c)}`);
		assert.equal(exactTravelBeyond(...c), oracleBeyond(...c), JSON.stringify(c));
		assert.equal(travelBeyond(...c), oracleBeyond(...c));
	}
});

/** The built module with each replacement made once -- each must occur exactly once -- imported from a scratch file. */
async function mutant(replacements, dir) {
	let text = fs.readFileSync(builtTravel, "utf8");
	for (const [from, to] of replacements) {
		assert.equal(text.split(from).length - 1, 1, `the built fallback holds "${from}" exactly once`);
		text = text.replace(from, to);
	}
	const file = path.join(dir, `travel-${Math.random().toString(36).slice(2)}.mjs`);
	fs.writeFileSync(file, text);
	return import(pathToFileURL(file).href);
}

test("I9: mutations of the fallback's comparison, sign, subnormal decoding and shift each fail the built cases", async () => {
	const dir = scratchFolder("input-binding-mutant-");
	try {
		const forced = forcedCases();
		const failures = async (replacements) => {
			const m = await mutant(replacements, dir);
			let failed = 0;
			for (const c of forced) {
				try {
					if (m.travelBeyond(...c) !== oracleBeyond(...c)) failed++;
				} catch {
					failed++;
				}
			}
			return failed;
		};
		assert.equal(await failures([]), 0, "the built module, copied unchanged, passes every case");
		const mutations = {
			"greater-or-equal": [["return squaredTravel > squaredThreshold;", "return squaredTravel >= squaredThreshold;"]],
			"sign dropped": [["const significand = high >>> 31 === 1 ? -magnitude : magnitude;", "const significand = magnitude;"]],
			"subnormal given a hidden bit": [["exponent = -1074;", "exponent = -1074;\n        magnitude |= 1n << 52n;"]],
			"subnormal's wrong exponent": [["exponent = -1074;", "exponent = -1075;"]],
			"shift to the greatest exponent": [["Math.min(...exponents)", "Math.max(...exponents)"]],
		};
		const caught = {};
		for (const [name, replacements] of Object.entries(mutations)) caught[name] = await failures(replacements);
		for (const [name, count] of Object.entries(caught)) assert.ok(count > 0, `the mutation "${name}" fails ${count} built cases`);
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I9: the session's beyond and trigger agree with the oracle over generated streams, and over every built case", () => {
	const rnd = seededRandom();
	const { int, pick } = randomTools(rnd);
	const cases = [...forcedCases(), ...targetedCases(rnd, 2000), ...sweepCases(rnd, 2000)];
	for (const [x0, y0, x1, y1, t] of cases) {
		const s = session(t);
		down(s, x0, y0);
		const crossed = move(s, x1, y1).crossed;
		assert.equal(crossed, oracleBeyond(x0, y0, x1, y1, t), JSON.stringify([x0, y0, x1, y1, t]));
		assert.equal(s.pointerUp({ button: 0 }).trigger, crossed ? "drop" : "click");
	}
	const gestures = [{ name: "g", engaged: true, button: null }];
	let drops = 0, clicks = 0;
	for (let n = 0; n < 1500; n++) {
		const threshold = pick([4, 4, 0, 1e-300, 1e300, 0.5 + rnd() * 10]);
		const s = session(threshold, gestures);
		let model = initialModel();
		let origin = [0, 0];
		for (let k = int(2, 12); k > 0; k--) {
			const choice = int(0, 9);
			let op;
			if (choice < 2) {
				origin = pick([[0, 0], [rnd() * 2000 - 1000, rnd() * 2000 - 1000], [(rnd() - 0.5) * threshold * 100, (rnd() - 0.5) * threshold * 100], [(rnd() - 0.5) * threshold * 100, (rnd() - 0.5) * threshold * 100], [1e300, -1e300], [Number.MIN_VALUE, 0]]);
				op = { kind: "down", x: origin[0], y: origin[1], button: 0 };
			} else if (choice < 7) {
				const factor = pick([0.5, 1, 1, 2, 3, 1 + 2 ** -52, 1 - 2 ** -52]), theta = rnd() * 2 * Math.PI;
				const x = origin[0] + threshold * factor * Math.cos(theta), y = origin[1] + threshold * factor * Math.sin(theta);
				const [c] = sweepCases(rnd, 1);
				op = Number.isFinite(x) && Number.isFinite(y) && choice < 6 ? { kind: "move", x, y } : { kind: "move", x: c[2], y: c[3] };
			} else if (choice < 9) op = { kind: "up", button: 0 };
			else op = model.gesture === null ? { kind: "start", gesture: "g", from: { x: origin[0], y: origin[1] } } : { kind: "lost" };
			const expected = modelStep(model, { threshold, gestures }, op);
			const got = applyToSession(s, op);
			if (op.kind === "up") {
				assert.equal(got.trigger, expected.extra.trigger);
				got.trigger === "drop" ? drops++ : clicks++;
			}
			if (op.kind === "move") assert.equal(got.crossed, expected.extra.crossed);
			model = expected.model;
			assert.deepEqual(modelOf(s.state), model);
		}
	}
	assert.ok(drops > 100 && clicks > 300, `${drops} drops and ${clicks} clicks`);
});
