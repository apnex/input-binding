// live-gesture - IB11 and IB12 (I10, I11, I12): the one live gesture, and which phase each input and each
// request makes due for it, by the declared gestures and the inputs alone; every refusal; the identity of
// states and records; every outcome's form; re-entry from an argument's code.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGestureSession } from "@apnex/input-binding";
import { randomTools, seededRandom } from "../support/doubles.js";
import { describe, holdsNegativeZero, isFrozenToDepth } from "../support/frozen.js";
import { applyToSession, initialModel, modelOf, modelStep } from "../support/lifecycle-model.js";

const GESTURES = [
	{ name: "pending", engaged: false, button: null },
	{ name: "move", engaged: true, button: null },
	{ name: "chain", engaged: true, button: 0 },
	{ name: "pan", engaged: true, button: 1 },
];
const open = (threshold = 4) => openGestureSession({ threshold, gestures: GESTURES }).session;
const fact = (x = 0, y = 0, button = 0) => ({ at: { x, y }, button });
const refusedError = (fn, call) => assert.throws(call, (e) => e.constructor === Error && e.message.startsWith(`${fn}:`), `${fn} is refused with an Error`);
const malformedArgument = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);
const live = (name, row = null) => ({ name, row, engaged: GESTURES.find((g) => g.name === name).engaged });

test("IB11 pointerDown: the live gesture takes a press of its declared button; any other press is unmatched; no phase either way", () => {
	for (const [gesture, button, taken] of [[null, 0, false], ["chain", 0, true], ["chain", 1, false], ["pan", 1, true], ["move", 0, false], ["pending", 3, false]]) {
		const s = open();
		if (gesture) s.startGesture({ gesture });
		const outcome = s.pointerDown(fact(1, 2, button));
		assert.deepEqual(outcome, { state: s.state, phase: null, gesture: null, taken }, `${gesture}, button ${button}`);
		assert.deepEqual(s.state.press, { at: { x: 1, y: 2 }, beyond: false, unmatched: !taken });
		assert.deepEqual(s.state.gesture, gesture ? live(gesture) : null, "the live gesture stays");
	}
});

test("IB11 pressMatched: cancel while a gesture is live, the press staying unmatched; then start; or no phase for an action", () => {
	const s = open();
	s.pointerDown(fact());
	const started = s.pressMatched({ id: "row-a", opens: "move" });
	assert.equal(started.phase, "start");
	assert.deepEqual(started.gesture, live("move", "row-a"));
	assert.equal(started.gesture, s.state.gesture);
	assert.equal(s.state.press.unmatched, false);
	refusedError("pressMatched", () => s.pressMatched({ id: "row-a", opens: "move" }));
	s.pointerDown(fact(5, 5));
	const cancelled = s.pressMatched({ id: "row-b", opens: "pending" });
	assert.equal(cancelled.phase, "cancel");
	assert.deepEqual(cancelled.gesture, live("move", "row-a"), "the gesture that ended");
	assert.equal(s.state.gesture, null);
	assert.equal(s.state.press.unmatched, true, "the press stays unmatched, so the start it opens can follow");
	const next = s.pressMatched({ id: "row-b", opens: "pending" });
	assert.equal(next.phase, "start");
	assert.deepEqual(s.state.gesture, live("pending", "row-b"));
	s.pointerDown(fact());
	s.cancelGesture();
	const action = s.pressMatched({ id: "row-c", opens: null });
	assert.deepEqual(action, { state: s.state, phase: null, gesture: null });
	assert.equal(s.state.press.unmatched, false);
	assert.equal(s.state.gesture, null);
});

test("IB11 pressMatched is refused with no press, a taken press, or a press already matched -- and changes nothing", () => {
	const s = open();
	const empty = s.state;
	refusedError("pressMatched", () => s.pressMatched({ id: "x", opens: null }));
	assert.equal(s.state, empty);
	s.startGesture({ gesture: "chain" });
	s.pointerDown(fact(0, 0, 0));
	assert.equal(s.state.press.unmatched, false, "taken");
	const before = s.state;
	refusedError("pressMatched", () => s.pressMatched({ id: "x", opens: "move" }));
	assert.equal(s.state, before);
});

test("IB11 pointerMove: update while a gesture is live, none otherwise", () => {
	const s = open();
	s.pointerDown(fact());
	assert.deepEqual(s.pointerMove({ at: { x: 1, y: 0 } }), { state: s.state, phase: null, gesture: null, crossed: false });
	s.pressMatched({ id: "r", opens: "move" });
	const outcome = s.pointerMove({ at: { x: 9, y: 0 } });
	assert.deepEqual(outcome, { state: s.state, phase: "update", gesture: live("move", "r"), crossed: true });
	assert.equal(outcome.gesture, s.state.gesture);
	const s2 = open();
	s2.startGesture({ gesture: "pending" });
	assert.equal(s2.pointerMove({ at: { x: 1, y: 1 } }).phase, "update", "a gesture with no press updates too");
});

test("IB11 pointerUp: commit when the live gesture declares no button or the fact's; otherwise the gesture stays live; the press ends with its trigger either way", () => {
	for (const [gesture, button, commits] of [["move", 0, true], ["move", 2, true], ["pending", 1, true], ["chain", 0, true], ["chain", 1, false], ["pan", 0, false], ["pan", 1, true]]) {
		const s = open();
		s.pointerDown(fact());
		s.startGesture({ gesture, row: "r" });
		s.pointerMove({ at: { x: 10, y: 0 } });
		const outcome = s.pointerUp({ button });
		assert.deepEqual(outcome, { state: s.state, phase: commits ? "commit" : null, gesture: commits ? live(gesture, "r") : null, trigger: "drop" }, `${gesture}, button ${button}`);
		assert.equal(s.state.press, null);
		assert.deepEqual(s.state.gesture, commits ? null : live(gesture, "r"));
	}
	const s = open();
	assert.deepEqual(s.pointerUp({ button: 0 }), { state: s.state, phase: null, gesture: null, trigger: "click" });
});

test("IB11 pointerLost: cancel while a gesture is live; the press ends; none otherwise", () => {
	const s = open();
	s.pointerDown(fact());
	assert.deepEqual(s.pointerLost(), { state: s.state, phase: null, gesture: null });
	assert.equal(s.state.press, null);
	s.pointerDown(fact());
	s.pressMatched({ id: "r", opens: "chain" });
	assert.deepEqual(s.pointerLost(), { state: s.state, phase: "cancel", gesture: live("chain", "r") });
	assert.deepEqual(s.state, { press: null, gesture: null });
	s.startGesture({ gesture: "move" });
	assert.equal(s.pointerLost().phase, "cancel", "a gesture with no press is cancelled too");
});

test("IB11 requests: start when none is live, refused when one is; become when one is live, refused when none is; cancel, or no phase", () => {
	const s = open();
	refusedError("becomeGesture", () => s.becomeGesture({ gesture: "move" }));
	assert.deepEqual(s.cancelGesture(), { state: s.state, phase: null, gesture: null });
	const started = s.startGesture({ gesture: "pending", row: "r1" });
	assert.deepEqual(started, { state: s.state, phase: "start", gesture: live("pending", "r1") });
	refusedError("startGesture", () => s.startGesture({ gesture: "move" }));
	const become = s.becomeGesture({ gesture: "move" });
	assert.deepEqual(become, { state: s.state, phase: "become", gesture: live("move", "r1"), was: live("pending", "r1") });
	assert.equal(become.was, started.gesture, "was is the gesture as it was, the very record");
	assert.deepEqual(s.cancelGesture(), { state: s.state, phase: "cancel", gesture: live("move", "r1") });
	assert.equal(s.state.gesture, null);
	assert.equal(s.startGesture({ gesture: "chain" }).gesture.row, null, "row absent: null");
});

test("IB11: row kept through becomeGesture, and engaged following the declared gesture", () => {
	const s = open();
	s.pointerDown(fact());
	s.pressMatched({ id: "press-row", opens: "pending" });
	assert.equal(s.state.gesture.engaged, false);
	s.becomeGesture({ gesture: "move" });
	assert.deepEqual(s.state.gesture, { name: "move", row: "press-row", engaged: true });
	s.becomeGesture({ gesture: "pending" });
	assert.deepEqual(s.state.gesture, { name: "pending", row: "press-row", engaged: false });
});

test("IB11: a gesture argument's form -- row given as null, undefined or empty, row given to becomeGesture, any other property, no argument, an undeclared gesture -- is malformed", () => {
	const s = open();
	for (const args of [undefined, null, 5, "move", [], () => ({}), Object.create({ gesture: "move" }), {}, { gesture: "nope" }, { gesture: 5 }, { gesture: undefined }, { gesture: "move", row: null }, { gesture: "move", row: undefined }, { gesture: "move", row: "" }, { gesture: "move", row: 5 }, { gesture: "move", from: null }, { gesture: "move", from: undefined }, { gesture: "move", from: { x: 1 } }, { gesture: "move", from: { x: 1, y: Infinity } }, { gesture: "move", from: () => 0 }, { gesture: "move", other: 1 }, Object.defineProperty({}, "gesture", { get: () => "move", enumerable: true })]) {
		malformedArgument("startGesture", () => s.startGesture(args), describe(args));
	}
	malformedArgument("startGesture", () => s.startGesture(), "no argument");
	s.startGesture({ gesture: "move" });
	for (const args of [undefined, {}, { gesture: "move", row: "r" }, { gesture: "nope" }, { gesture: "move", from: { x: "1", y: 0 } }, { gesture: "move", extra: true }]) malformedArgument("becomeGesture", () => s.becomeGesture(args), describe(args));
	assert.equal(s.startGesture.length, 1);
	const withSymbol = { gesture: "pending", [Symbol("s")]: 1 };
	assert.equal(s.becomeGesture(withSymbol).phase, "become", "a symbol-named property is ignored");
});

test("IB11: a match's form -- a plain object holding id, a non-empty string, and opens, a declared name or null -- its other properties unread", () => {
	const s = open();
	s.pointerDown(fact());
	for (const match of [undefined, null, "m", [], Object.create({ id: "x", opens: null }), {}, { id: "x" }, { opens: null }, { id: "", opens: null }, { id: 5, opens: null }, { id: "x", opens: "nope" }, { id: "x", opens: undefined }, { id: "x", opens: 5 }, Object.defineProperty({ opens: null }, "id", { get: () => "x", enumerable: true })]) {
		malformedArgument("pressMatched", () => s.pressMatched(match), describe(match));
	}
	assert.equal(s.state.press.unmatched, true, "nothing changed");
	const entry = Object.defineProperty({ id: "x", opens: "move", owner: "o" }, "row", { get: () => assert.fail("pressMatched read the row"), enumerable: true });
	assert.equal(s.pressMatched(entry).phase, "start", "its owner and row are not read");
});

test("I10: over generated sequences of operations, every outcome names the phase IB11's tables give; at most one live; each life ends once; started equals ended plus live; every refused operation throws and changes nothing", () => {
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	const declaration = { threshold: 4, gestures: GESTURES };
	const counts = { start: 0, update: 0, become: 0, commit: 0, cancel: 0, refused: 0, none: 0 };
	for (let n = 0; n < 600; n++) {
		const s = openGestureSession(declaration).session;
		let model = initialModel();
		let started = 0, ended = 0;
		const endedLives = new Set();
		let life = null;
		for (let k = int(5, 40); k > 0; k--) {
			const point = () => ({ x: pick([0, 1, 3, 4, 5, -6, 2.5]), y: pick([0, 3, -4, 0.5]) });
			const kind = pick(["down", "down", "matched", "matched", "move", "move", "move", "up", "up", "lost", "start", "become", "cancel"]);
			const op = { kind };
			if (kind === "down") Object.assign(op, point(), { button: pick([0, 0, 1, 2]) });
			if (kind === "move") Object.assign(op, point());
			if (kind === "up") op.button = pick([0, 0, 1, 2]);
			if (kind === "matched") Object.assign(op, { id: `r${int(0, 5)}`, opens: pick([null, ...GESTURES.map((g) => g.name)]) });
			if (kind === "start") Object.assign(op, { gesture: pick(GESTURES).name }, chance(0.5) ? { row: `r${int(0, 5)}` } : {}, chance(0.5) ? { from: point() } : {});
			if (kind === "become") Object.assign(op, { gesture: pick(GESTURES).name }, chance(0.5) ? { from: point() } : {});
			const expected = modelStep(model, declaration, op);
			const before = s.state;
			if (expected.refused) {
				assert.throws(() => applyToSession(s, op), (e) => e.constructor === Error, `${kind} is refused`);
				assert.equal(s.state, before, "a refused operation changes nothing");
				counts.refused++;
				continue;
			}
			const outcome = applyToSession(s, op);
			assert.equal(outcome.phase, expected.phase, `${kind} from ${describe(model)}`);
			assert.deepEqual(outcome.gesture === null ? null : { ...outcome.gesture }, expected.gesture === null ? null : { ...expected.gesture });
			for (const [key, value] of Object.entries(expected.extra ?? {})) assert.deepEqual(key === "was" ? { ...outcome.was } : outcome[key], value, key);
			model = expected.model;
			assert.deepEqual(modelOf(s.state), model);
			assert.equal(outcome.state, s.state);
			counts[outcome.phase ?? "none"]++;
			if (outcome.phase === "start") {
				assert.equal(life, null, "at most one live");
				started++;
				life = { id: started };
			}
			if (outcome.phase === "commit" || outcome.phase === "cancel") {
				assert.ok(life !== null && !endedLives.has(life.id), "a life ends at most once");
				endedLives.add(life.id);
				ended++;
				life = null;
			}
			assert.equal(started, ended + (s.state.gesture === null ? 0 : 1), "started equals ended plus live");
			assert.equal(s.state.gesture === null, life === null);
		}
	}
	for (const [phase, count] of Object.entries(counts)) assert.ok(count > 200, `${phase}: ${count}`);
});

test("IB12: each identity case -- the very same state, press, point and gesture exactly when every field is equal", () => {
	const s = open();
	const empty = s.state;
	for (const call of [() => s.pointerMove({ at: { x: 1, y: 1 } }), () => s.pointerLost(), () => s.cancelGesture(), () => s.pointerUp({ button: 0 })]) {
		assert.equal(call().state, empty, "an operation that changes nothing leaves the very same state");
	}
	s.pointerDown(fact(2, 3));
	const pressed = s.state;
	assert.notEqual(pressed, empty);
	assert.equal(s.pointerDown(fact(2, 3)).state, pressed, "a press at the press's own point, not beyond, unmatched alike");
	assert.equal(s.pointerDown({ at: { x: 2 + 0, y: 3 }, button: 1 }).state, pressed, "the button is not part of the press");
	assert.notEqual(s.pointerDown(fact(2, 4)).state, pressed);
	const at = s.state.press.at;
	s.pointerMove({ at: { x: 2, y: 9 } });
	assert.equal(s.state.press.beyond, true);
	assert.equal(s.state.press.at, at, "the point is the very same record when its x and y are");
	const beyondPress = s.state.press;
	assert.equal(s.pointerMove({ at: { x: 50, y: 50 } }).state.press, beyondPress, "already beyond");
	assert.notEqual(s.pointerDown(fact(2, 4)).state.press, beyondPress, "a press at its own point once beyond is a new press");
	assert.equal(s.state.press.at, at);
	const freshPress = s.state.press;
	const started = s.startGesture({ gesture: "pending", from: { x: 2, y: 4 } });
	assert.equal(started.state.press, freshPress, "a restart from the press's own point while it is not beyond keeps the very same press");
	assert.notEqual(started.state, pressed, "the gesture started, so a new state");
	const pressBefore = s.state.press;
	const gestureBefore = s.state.gesture;
	const same = s.becomeGesture({ gesture: "pending" });
	assert.equal(same.state, started.state, "become to its own name with no restart leaves the very same state");
	assert.equal(same.gesture, same.was);
	const restarted = s.becomeGesture({ gesture: "pending", from: { x: 2, y: 4 } });
	assert.equal(restarted.state.press, pressBefore, "a restart from the press's own point while it is not beyond");
	assert.equal(restarted.state, same.state);
	s.pointerMove({ at: { x: 2, y: 3 } });
	assert.equal(s.state.gesture, gestureBefore, "a move leaves the gesture the very same record");
	const other = s.becomeGesture({ gesture: "move" });
	assert.notEqual(other.gesture, gestureBefore);
	assert.equal(other.state.press, s.state.press);
});

test("IB12: each operation's outcome, its keys in the order the table writes them, fresh each call", () => {
	const s = open();
	const keys = (o) => Object.keys(o);
	assert.deepEqual(keys(s.pointerDown(fact())), ["state", "phase", "gesture", "taken"]);
	assert.deepEqual(keys(s.pressMatched({ id: "r", opens: "move" })), ["state", "phase", "gesture"]);
	assert.deepEqual(keys(s.pointerMove({ at: { x: 1, y: 1 } })), ["state", "phase", "gesture", "crossed"]);
	assert.deepEqual(keys(s.becomeGesture({ gesture: "pending" })), ["state", "phase", "gesture", "was"]);
	assert.deepEqual(keys(s.pointerUp({ button: 0 })), ["state", "phase", "gesture", "trigger"]);
	assert.deepEqual(keys(s.startGesture({ gesture: "chain" })), ["state", "phase", "gesture"]);
	assert.deepEqual(keys(s.cancelGesture()), ["state", "phase", "gesture"]);
	assert.deepEqual(keys(s.pointerLost()), ["state", "phase", "gesture"]);
	s.pointerDown(fact(1, -1));
	s.startGesture({ gesture: "pan", row: "r" });
	assert.deepEqual(keys(s.state), ["press", "gesture"]);
	assert.deepEqual(keys(s.state.press), ["at", "beyond", "unmatched"]);
	assert.deepEqual(keys(s.state.press.at), ["x", "y"]);
	assert.deepEqual(keys(s.state.gesture), ["name", "row", "engaged"]);
	const a = s.cancelGesture(), b = s.cancelGesture();
	assert.notEqual(a, b, "a fresh outcome each call, even when the state is the very same");
	assert.equal(b.state, a.state);
});

test("I12: every state and outcome is frozen to its depth and holds no -0; the same sequence gives the same states and outcomes", () => {
	const run = () => {
		const s = open();
		const out = [];
		const ops = [() => s.pointerDown(fact(-0, -0)), () => s.pressMatched({ id: "r", opens: "pending" }), () => s.pointerMove({ at: { x: -0, y: 5 } }), () => s.becomeGesture({ gesture: "move", from: { x: -0, y: -0 } }), () => s.pointerMove({ at: { x: 3, y: 4 } }), () => s.pointerUp({ button: 0 }), () => s.startGesture({ gesture: "chain", row: "x" }), () => s.pointerDown(fact(1, 1, 0)), () => s.pointerLost()];
		for (const op of ops) {
			const outcome = op();
			assert.ok(isFrozenToDepth(outcome), describe(outcome));
			assert.ok(!holdsNegativeZero(outcome), describe(outcome));
			out.push(outcome);
		}
		return out;
	};
	const first = run(), second = run();
	assert.deepEqual(second, first);
	assert.equal(describe(second), describe(first));
});

test("I12: the edge of determinism -- one fact whose point's getter counts its reads gives two fresh sessions two origins", () => {
	let reads = 0;
	const at = {
		get x() {
			return 10 * reads++;
		},
		y: 0,
	};
	const shared = { at, button: 0 };
	const s1 = open(), s2 = open();
	s1.pointerDown(shared);
	s2.pointerDown(shared);
	assert.deepEqual([s1.state.press.at.x, s2.state.press.at.x], [0, 10]);
	assert.equal(reads, 2, "x read once each");
});

test("I11: an argument's trap or getter that calls the session takes effect before the transition, which sees the state it left", () => {
	const s = open();
	s.startGesture({ gesture: "move" });
	const args = new Proxy(
		{ gesture: "chain" },
		{
			getOwnPropertyDescriptor(t, key) {
				if (key === "gesture") s.cancelGesture();
				return Reflect.getOwnPropertyDescriptor(t, key);
			},
		},
	);
	const outcome = s.startGesture(args);
	assert.equal(outcome.phase, "start", "the trap cancelled the live gesture, so startGesture may start");
	assert.deepEqual(s.state.gesture, live("chain"));
	// a point whose getter starts a gesture that takes the press
	const t = open();
	const point = {
		get x() {
			t.startGesture({ gesture: "chain" });
			return 0;
		},
		y: 0,
	};
	assert.equal(t.pointerDown({ at: point, button: 0 }).taken, true, "pointerDown sees the gesture its argument's getter started");
	// a getter that calls the session and then throws leaves its own call's effect, and nothing of the throwing operation's
	const u = open();
	u.startGesture({ gesture: "move" });
	u.pointerDown(fact());
	const throwing = new Proxy(
		{ gesture: "chain" },
		{
			ownKeys(target) {
				u.cancelGesture();
				throw new Error("the trap's own");
			},
		},
	);
	malformedArgument("startGesture", () => u.startGesture(throwing), "an argument whose trap throws");
	assert.equal(u.state.gesture, null, "the trap's cancel stands");
	assert.equal(u.state.press.unmatched, true, "nothing of startGesture's");
	const v = open();
	v.pointerDown(fact(5, 5));
	const pointThrows = {
		get x() {
			v.pointerLost();
			return 1;
		},
		get y() {
			throw new RangeError("y");
		},
	};
	malformedArgument("pointerMove", () => v.pointerMove({ at: pointThrows }), "a point whose y getter throws");
	assert.equal(v.state.press, null, "the getter's pointerLost stands");
	// a re-entrant call made while pressMatched reads its match: the cancel it makes is seen
	const w = open();
	w.pointerDown(fact());
	w.startGesture({ gesture: "pending" });
	const match = new Proxy(
		{ id: "r", opens: "move" },
		{
			getPrototypeOf(target) {
				w.cancelGesture();
				return Reflect.getPrototypeOf(target);
			},
		},
	);
	assert.equal(w.pressMatched(match).phase, "start", "pressMatched sees no live gesture, so starts rather than cancels");
});
