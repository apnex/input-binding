// press-resolution - IB15 (I17): a press resolved in one call -- pointerDown's transition; the application's
// match, unless the press is taken; pressMatched's transition while the press is still unmatched; and, on a
// cancel, the application's cancelled and pressMatched's transition once more -- against the calls written
// out by hand; each row of IB15's table driven by recording callbacks; and the reading of its arguments.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGestureSession } from "@apnex/input-binding";
import { randomTools, seededRandom } from "../support/doubles.js";
import { describe, isFrozenToDepth } from "../support/frozen.js";
import { applyToSession, modelOf, randomOperation } from "../support/lifecycle-model.js";
import { phantom, recorded } from "../support/recording-proxy.js";

const GESTURES = [
	{ name: "pending", engaged: false, button: null },
	{ name: "move", engaged: true, button: null },
	{ name: "chain", engaged: true, button: 0 },
	{ name: "pan", engaged: true, button: 1 },
];
const open = () => openGestureSession({ threshold: 4, gestures: GESTURES }).session;
const fact = (x = 0, y = 0, button = 0) => ({ at: { x, y }, button });
const live = (name, row = null) => ({ name, row, engaged: GESTURES.find((g) => g.name === name).engaged });
const malformed = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);
const noGetter = (name) => ({ get: () => assert.fail(`the getter of ${name} ran`), enumerable: true, configurable: true });

test("IB15: a press no gesture is live for, whose match opens a gesture -- start, the press no longer unmatched; match called once with no receiver and no argument", () => {
	const s = open();
	const calls = [];
	const answer = { id: "row-a", opens: "move", owner: "app", row: {} };
	// a module's functions are strict, so a function called with no receiver sees this undefined
	const outcome = s.resolvePress(fact(1, 2), {
		match: function (...args) {
			calls.push({ self: this, args });
			return answer;
		},
	});
	assert.deepEqual(calls, [{ self: undefined, args: [] }]);
	assert.deepEqual(outcome, { state: s.state, taken: false, match: answer, cancelled: null, phase: "start", gesture: live("move", "row-a") });
	assert.equal(outcome.match, answer, "the very value match answered");
	assert.equal(outcome.gesture, s.state.gesture);
	assert.deepEqual(s.state.press, { at: { x: 1, y: 2 }, beyond: false, unmatched: false, button: 0, pointer: null });
	assert.deepEqual(Object.keys(outcome), ["state", "taken", "match", "cancelled", "phase", "gesture"]);
	assert.ok(isFrozenToDepth(outcome, new Set([answer])));
	assert.ok(!Object.isFrozen(answer), "the match answered is the application's, never frozen");
});

test("IB15: a match opening no gesture is an action -- no phase, the press matched; a match of null leaves the press unmatched, as a press no row matches", () => {
	const s = open();
	const action = s.resolvePress(fact(), { match: () => ({ id: "act", opens: null }) });
	assert.deepEqual(action, { state: s.state, taken: false, match: { id: "act", opens: null }, cancelled: null, phase: null, gesture: null });
	assert.equal(s.state.press.unmatched, false);
	const nothing = s.resolvePress(fact(5, 5), { match: () => null, cancelled: () => assert.fail("cancelled ran") });
	assert.deepEqual(nothing, { state: s.state, taken: false, match: null, cancelled: null, phase: null, gesture: null });
	assert.equal(s.state.press.unmatched, true, "left unmatched");
	assert.deepEqual(s.state.press.at, { x: 5, y: 5 }, "the press was made");
});

test("IB15: a taken press answers at once -- match never called, nothing cancelled or started, the gesture still live", () => {
	const s = open();
	s.startGesture({ gesture: "chain", row: "c" });
	const outcome = s.resolvePress(fact(3, 3, 0), { match: () => assert.fail("match ran on a taken press"), cancelled: () => assert.fail("cancelled ran") });
	assert.deepEqual(outcome, { state: s.state, taken: true, match: null, cancelled: null, phase: null, gesture: null });
	assert.deepEqual(s.state.gesture, live("chain", "c"));
	assert.equal(s.state.press.unmatched, false);
});

test("IB15: a match while a gesture is live -- the cancel handed to cancelled, which sees no live gesture, then the start; cancelled reported, the phase start, never cancel", () => {
	const s = open();
	s.startGesture({ gesture: "pending", row: "p" });
	const seen = [];
	const outcome = s.resolvePress(fact(0, 0, 2), {
		match: () => ({ id: "row-b", opens: "move" }),
		cancelled: function (...args) {
			seen.push({ self: this, args, gesture: s.state.gesture, unmatched: s.state.press.unmatched });
		},
	});
	assert.equal(seen.length, 1);
	assert.equal(seen[0].self, undefined, "no receiver");
	assert.equal(seen[0].args.length, 1, "one argument, the cancel outcome");
	assert.equal(seen[0].gesture, null, "cancelled sees no live gesture");
	assert.equal(seen[0].unmatched, true, "and the press still unmatched");
	const [cancel] = seen[0].args;
	assert.deepEqual(cancel, { state: cancel.state, phase: "cancel", gesture: live("pending", "p") });
	assert.equal(outcome.cancelled, cancel, "the very outcome cancelled was handed");
	assert.equal(outcome.phase, "start");
	assert.deepEqual(outcome.gesture, live("move", "row-b"));
	assert.deepEqual(s.state.gesture, live("move", "row-b"));
	const noCancelled = open();
	noCancelled.startGesture({ gesture: "pending" });
	const quiet = noCancelled.resolvePress(fact(0, 0, 2), { match: () => ({ id: "row-c", opens: null }) });
	assert.equal(quiet.cancelled.phase, "cancel", "with no cancelled, the cancel is still reported");
	assert.equal(quiet.phase, null, "and the second transition makes the action");
	assert.equal(noCancelled.state.press.unmatched, false);
	assert.equal(noCancelled.state.gesture, null);
});

test("IB15's table: match ends, replaces or matches the press -- no transition, phase null; a move or a restart keeps the press", () => {
	const answer = { id: "r", opens: "move" };
	for (const [label, act, unmatchedAfter] of [
		["ends it by pointerUp", (s) => s.pointerUp({ button: 0 }), null],
		["ends it by pointerLost", (s) => s.pointerLost(), null],
		["replaces it by pointerDown at its own point", (s) => s.pointerDown(fact()), true],
		["replaces it by a nested resolvePress answering null", (s) => s.resolvePress(fact(), { match: () => null }), true],
		["matches it by pressMatched", (s) => s.pressMatched({ id: "other", opens: null }), false],
	]) {
		const s = open();
		const outcome = s.resolvePress(fact(), { match: () => (act(s), answer), cancelled: () => assert.fail("cancelled ran") });
		assert.deepEqual(outcome, { state: s.state, taken: false, match: answer, cancelled: null, phase: null, gesture: null }, label);
		assert.equal(s.state.gesture, null, `${label}: nothing started`);
		assert.equal(s.state.press === null ? null : s.state.press.unmatched, unmatchedAfter, label);
	}
	for (const [label, act] of [["moves it beyond", (s) => s.pointerMove({ at: { x: 9, y: 0 } })], ["moves it by its own pointer", (s) => s.pointerMove({ at: { x: 1, y: 0 }, pointerId: null })], ["ignores another pointer's release", (s) => s.pointerUp({ button: 0, pointerId: 5 })]]) {
		const s = open();
		const outcome = s.resolvePress(fact(), { match: () => (act(s), answer) });
		assert.equal(outcome.phase, "start", `${label}: still the press, still unmatched`);
	}
});

test("IB15's table: match starts a gesture, the press still unmatched -- step 4's cancel ends that gesture and calls cancelled; then the start", () => {
	const s = open();
	const seen = [];
	const outcome = s.resolvePress(fact(), {
		match: () => {
			s.startGesture({ gesture: "pending", row: "mine", from: { x: 2, y: 2 } });
			return { id: "r", opens: "move" };
		},
		cancelled: (cancel) => seen.push(cancel.gesture),
	});
	assert.deepEqual(seen, [live("pending", "mine")], "the gesture match started is the one cancelled");
	assert.deepEqual(outcome.cancelled.gesture, live("pending", "mine"));
	assert.equal(outcome.phase, "start");
	assert.deepEqual(s.state.press.at, { x: 2, y: 2 }, "the restart kept the press");
});

test("IB15's table: cancelled ends, replaces or matches the press, or starts a gesture -- no second transition, phase null; so a call cancels at most one gesture", () => {
	for (const [label, act, gestureAfter] of [
		["ends it", (s) => s.pointerLost(), null],
		["replaces it", (s) => s.pointerDown(fact(7, 7)), null],
		["matches it", (s) => s.pressMatched({ id: "x", opens: null }), null],
		["starts a gesture", (s) => s.startGesture({ gesture: "pan", row: "own" }), live("pan", "own")],
	]) {
		const s = open();
		s.startGesture({ gesture: "pending" });
		const outcome = s.resolvePress(fact(), { match: () => ({ id: "r", opens: "move" }), cancelled: () => act(s) });
		assert.equal(outcome.cancelled.phase, "cancel", label);
		assert.equal(outcome.phase, null, `${label}: no second transition`);
		assert.equal(outcome.gesture, null);
		assert.deepEqual(s.state.gesture, gestureAfter, label);
	}
});

test("IB15's table: a callback that throws -- the error propagates and the transitions made stand", () => {
	const thrown = new SyntaxError("the application's own");
	const s = open();
	assert.throws(() => s.resolvePress(fact(4, 4), { match: () => {
		throw thrown;
	} }), (e) => e === thrown);
	assert.deepEqual(s.state.press.at, { x: 4, y: 4 }, "pointerDown's transition stands");
	assert.equal(s.state.press.unmatched, true);
	const t = open();
	t.startGesture({ gesture: "pending" });
	assert.throws(() => t.resolvePress(fact(), { match: () => ({ id: "r", opens: "move" }), cancelled: () => {
		throw thrown;
	} }), (e) => e === thrown);
	assert.equal(t.state.gesture, null, "the cancel stands");
	assert.equal(t.state.press.unmatched, true, "and no start was made");
});

test("IB15: the id and opens read decide every later transition, whatever a callback later does to the match", () => {
	const s = open();
	s.startGesture({ gesture: "pending" });
	const answer = { id: "first", opens: "move" };
	const outcome = s.resolvePress(fact(), {
		match: () => answer,
		cancelled: () => {
			answer.id = "changed";
			answer.opens = "pan";
		},
	});
	assert.deepEqual(outcome.gesture, live("move", "first"), "the second transition starts what was read");
	assert.equal(outcome.match, answer);
	assert.equal(answer.opens, "pan", "the change stands in the application's own value");
});

test("IB15: a malformed match answer -- undefined among them -- throws the function's own TypeError, pointerDown's transition standing", () => {
	const answers = [undefined, 0, "r", () => ({}), [], Object.create({ id: "r", opens: null }), {}, { id: "r" }, { opens: null }, { id: "", opens: null }, { id: "r", opens: "zoom" }, { id: "r", opens: undefined }, Object.defineProperty({ opens: null }, "id", noGetter("id")), phantom({ opens: null }, "id")];
	for (const [i, answered] of answers.entries()) {
		const s = open();
		malformed("resolvePress", () => s.resolvePress(fact(6, 6), { match: () => answered }), `answer ${i}`);
		assert.deepEqual(s.state.press.at, { x: 6, y: 6 }, "the press was made");
		assert.equal(s.state.press.unmatched, true);
	}
});

test("IB2: resolvePress reads the fact as pointerDown does, then the handlers -- prototype, own keys, match, cancelled -- and later match's answer -- prototype, id, opens", () => {
	const s = open();
	const log = [];
	const handlers = recorded({ cancelled: () => log.push("cancelled called"), match: () => (log.push("match called"), recorded({ id: "r", opens: "move", owner: "o", row: {} }, "answer", log)) }, "handlers", log);
	s.startGesture({ gesture: "pending" });
	s.resolvePress(recorded({ at: recorded({ x: 0, y: 0 }, "at", log), button: 2, pointerId: 3, key: "k" }, "fact", log), handlers);
	assert.deepEqual(log, [
		"fact getOwnPropertyDescriptor at",
		"at get x",
		"at get y",
		"fact getOwnPropertyDescriptor button",
		"fact getOwnPropertyDescriptor pointerId",
		"handlers getPrototypeOf",
		"handlers ownKeys",
		"handlers getOwnPropertyDescriptor match",
		"handlers getOwnPropertyDescriptor cancelled",
		"match called",
		"answer getPrototypeOf",
		"answer getOwnPropertyDescriptor id",
		"answer getOwnPropertyDescriptor opens",
		"cancelled called",
	]);
	log.length = 0;
	s.resolvePress(fact(), recorded({ match: () => null }, "handlers", log));
	assert.deepEqual(log, ["handlers getPrototypeOf", "handlers ownKeys", "handlers getOwnPropertyDescriptor match"], "an absent cancelled's descriptor is not read");
});

test("IB15: malformed handlers -- not a plain object, another key, no match, match or cancelled no function, cancelled present as undefined, an accessor -- each throws before the state is read, the state untouched; a malformed fact before the handlers are read", () => {
	const s = open();
	s.pointerDown(fact(1, 1));
	const before = s.state;
	const bad = [undefined, null, () => 0, [], Object.create({ match: () => null }), {}, { cancelled: () => 0 }, { match: () => null, other: 1 }, { match: null }, { match: {} }, { match: () => null, cancelled: null }, { match: () => null, cancelled: undefined }, { match: () => null, cancelled: 5 }, Object.defineProperty({}, "match", noGetter("match")), Object.defineProperty({ match: () => null }, "cancelled", noGetter("cancelled")), phantom({}, "match")];
	for (const [i, handlers] of bad.entries()) {
		malformed("resolvePress", () => s.resolvePress(fact(9, 9), handlers), `handlers ${i}`);
		assert.equal(s.state, before, `handlers ${i}: the state untouched`);
	}
	const log = [];
	malformed("resolvePress", () => s.resolvePress({ at: { x: 0, y: 0 }, button: "0" }, recorded({ match: () => null }, "handlers", log)), "a malformed fact");
	assert.deepEqual(log, [], "the handlers are not read after a malformed fact");
	assert.equal(s.state, before);
	assert.equal(s.resolvePress(fact(), phantom({ match: () => null }, "cancelled")).phase, null, "a phantom cancelled is absent");
	assert.equal(s.resolvePress.length, 2);
});

test("IB12: a trap that calls the session while resolvePress reads its arguments takes effect before pointerDown's transition", () => {
	const s = open();
	s.startGesture({ gesture: "chain" });
	const handlers = new Proxy({ match: () => assert.fail("match ran on a taken press") }, {
		ownKeys(target) {
			s.cancelGesture();
			s.startGesture({ gesture: "pan" });
			return Reflect.ownKeys(target);
		},
	});
	const outcome = s.resolvePress(fact(0, 0, 1), handlers);
	assert.equal(outcome.taken, true, "the press of button 1 is taken by the gesture the trap started, so match is never called");
	assert.deepEqual(s.state.gesture, live("pan"));
});

/** The calls written out by hand, as an application wrote them before resolvePress: each outcome, and the answer resolvePress would give. */
function byHand(session, f, match, cancelled) {
	const down = session.pointerDown(f);
	if (down.taken) return { state: session.state, taken: true, match: null, cancelled: null, phase: null, gesture: null };
	const answered = match();
	if (answered === null) return { state: session.state, taken: false, match: null, cancelled: null, phase: null, gesture: null };
	const first = session.pressMatched(answered);
	if (first.phase !== "cancel") return { state: session.state, taken: false, match: answered, cancelled: null, phase: first.phase, gesture: first.gesture };
	if (cancelled !== undefined) cancelled(first);
	const second = session.pressMatched(answered);
	return { state: session.state, taken: false, match: answered, cancelled: first, phase: second.phase, gesture: second.gesture };
}

test("I17: over generated sequences in which neither callback calls the session or changes the match, resolvePress gives the states and outcomes of the calls written out by hand", () => {
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	const declaration = { threshold: 4, gestures: GESTURES };
	const counts = { taken: 0, none: 0, action: 0, start: 0, cancelStart: 0, cancelAction: 0 };
	const project = (o) => ({ state: modelOf(o.state), taken: o.taken, match: o.match, cancelled: o.cancelled === null ? null : { state: modelOf(o.cancelled.state), phase: o.cancelled.phase, gesture: o.cancelled.gesture }, phase: o.phase, gesture: o.gesture });
	for (let n = 0; n < 500; n++) {
		const one = openGestureSession(declaration).session;
		const two = openGestureSession(declaration).session;
		for (let k = int(5, 30); k > 0; k--) {
			if (chance(0.4)) {
				const f = { at: { x: pick([0, 1, 5]), y: pick([0, 3]) }, button: pick([0, 0, 1, 2]), ...(chance(0.3) ? { pointerId: pick([null, 1, 2]) } : {}) };
				const answer = chance(0.25) ? null : { id: `r${int(0, 3)}`, opens: pick([null, ...GESTURES.map((g) => g.name)]) };
				const seenA = [], seenB = [];
				const withCancelled = chance(0.7);
				const a = one.resolvePress(f, withCancelled ? { match: () => answer, cancelled: (c) => seenA.push(modelOf(c.state)) } : { match: () => answer });
				const b = byHand(two, f, () => answer, withCancelled ? (c) => seenB.push(modelOf(c.state)) : undefined);
				assert.deepEqual(project(a), project(b), describe({ f, answer }));
				assert.deepEqual(seenA, seenB);
				counts[a.taken ? "taken" : answer === null ? "none" : a.cancelled !== null ? (a.phase === "start" ? "cancelStart" : "cancelAction") : a.phase === "start" ? "start" : "action"]++;
			} else {
				const op = randomOperation({ int, pick, chance }, GESTURES);
				let refusedOne = false, refusedTwo = false;
				try {
					applyToSession(one, op);
				} catch {
					refusedOne = true;
				}
				try {
					applyToSession(two, op);
				} catch {
					refusedTwo = true;
				}
				assert.equal(refusedOne, refusedTwo);
			}
			assert.deepEqual(modelOf(one.state), modelOf(two.state));
		}
	}
	for (const [key, count] of Object.entries(counts)) assert.ok(count > 50, `${key}: ${count}`);
});
