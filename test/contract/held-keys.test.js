// held-keys - IB14 (I16): the keys held, kept by the session in the order first pressed -- keyDown appending
// a code not held, keyUp removing one held, keysLost removing every one -- a key whose code is '' or null
// answered untracked, never refused and never given an identity; the outcomes and their identity; and no key
// operation changing the press or the gesture or making a phase due.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGestureSession } from "@apnex/input-binding";
import { randomTools, seededRandom } from "../support/doubles.js";
import { describe, isFrozenToDepth } from "../support/frozen.js";
import { applyToSession, initialModel, modelOf, modelStep, randomOperation } from "../support/lifecycle-model.js";
import { recorded } from "../support/recording-proxy.js";

const GESTURES = [{ name: "move", engaged: true, button: null }, { name: "chain", engaged: true, button: 0 }];
const open = () => openGestureSession({ threshold: 4, gestures: GESTURES }).session;
const malformed = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);

test("IB14 keyDown: a non-empty code not held is appended, held false; a code held already is a repeat, held true, the state the very same", () => {
	const s = open();
	const empty = s.state;
	assert.deepEqual(empty.keys, []);
	const a = s.keyDown({ code: "KeyA", key: "a", repeat: false });
	assert.deepEqual(a, { state: s.state, tracked: true, held: false });
	assert.deepEqual(s.state.keys, ["KeyA"]);
	assert.notEqual(s.state, empty);
	const keysAfterA = s.state.keys;
	const repeat = s.keyDown({ code: "KeyA", repeat: true });
	assert.deepEqual(repeat, { state: s.state, tracked: true, held: true });
	assert.equal(repeat.state, a.state, "a repeat changes nothing: the very same state");
	assert.equal(s.state.keys, keysAfterA, "and the very same array");
	s.keyDown({ code: "ShiftLeft" });
	s.keyDown({ code: "KeyB" });
	assert.deepEqual(s.state.keys, ["KeyA", "ShiftLeft", "KeyB"], "in the order first pressed");
	s.keyDown({ code: "KeyA" });
	assert.deepEqual(s.state.keys, ["KeyA", "ShiftLeft", "KeyB"], "a repeat does not move a key");
});

test("IB14 keyUp: a non-empty code held is removed, held true; a code not held -- pressed while the page lacked focus -- is held false, the state the very same", () => {
	const s = open();
	s.keyDown({ code: "KeyA" });
	s.keyDown({ code: "KeyB" });
	s.keyDown({ code: "KeyC" });
	const up = s.keyUp({ code: "KeyB" });
	assert.deepEqual(up, { state: s.state, tracked: true, held: true });
	assert.deepEqual(s.state.keys, ["KeyA", "KeyC"]);
	const before = s.state;
	const unseen = s.keyUp({ code: "KeyZ" });
	assert.deepEqual(unseen, { state: before, tracked: true, held: false });
	assert.equal(unseen.state, before, "a release whose press was not seen changes nothing");
	s.keyUp({ code: "KeyA" });
	s.keyUp({ code: "KeyC" });
	assert.deepEqual(s.state.keys, []);
	s.keyDown({ code: "KeyA" });
	assert.deepEqual(s.state.keys, ["KeyA"], "a key released and pressed again is held again");
});

test("IB14: a key whose code is '' or null -- the platform naming no physical key -- is answered untracked, the state unchanged, held null; key is never read in its place", () => {
	const s = open();
	s.keyDown({ code: "KeyA" });
	const before = s.state;
	for (const fn of ["keyDown", "keyUp"]) {
		for (const code of ["", null]) {
			const log = [];
			const outcome = s[fn](recorded({ code, key: "AudioVolumeUp" }, "fact", log));
			assert.deepEqual(outcome, { state: before, tracked: false, held: null }, `${fn}, ${JSON.stringify(code)}`);
			assert.equal(outcome.state, before);
			assert.deepEqual(log, ["fact getOwnPropertyDescriptor code"], "only code is read");
		}
	}
	assert.deepEqual(s.state.keys, ["KeyA"]);
});

test("IB14 keysLost: every code removed; released the very array the state held before -- the empty array itself when nothing was held, the state then the very same", () => {
	const s = open();
	const empty = s.state;
	const none = s.keysLost();
	assert.deepEqual(none, { state: empty, released: [] });
	assert.equal(none.released, empty.keys, "the very same empty array");
	assert.equal(none.state, empty, "nothing changed");
	s.keyDown({ code: "KeyA" });
	s.keyDown({ code: "ControlLeft" });
	const held = s.state.keys;
	const lost = s.keysLost();
	assert.equal(lost.released, held, "the very array held before");
	assert.deepEqual(lost.released, ["KeyA", "ControlLeft"]);
	assert.deepEqual(s.state.keys, []);
	assert.equal(lost.state, s.state);
	assert.ok(Object.isFrozen(lost.released) && Object.isFrozen(s.state.keys));
	assert.equal(s.keysLost.length, 0);
	assert.deepEqual(s.keysLost("extra", "arguments").released, [], "an argument beyond its form is never read");
});

test("IB14: the outcomes' keys in their written order, each fresh and frozen to its depth; state is { press, gesture, keys }", () => {
	const s = open();
	assert.deepEqual(Object.keys(s.keyDown({ code: "KeyA" })), ["state", "tracked", "held"]);
	assert.deepEqual(Object.keys(s.keyUp({ code: "KeyA" })), ["state", "tracked", "held"]);
	assert.deepEqual(Object.keys(s.keyDown({ code: "" })), ["state", "tracked", "held"]);
	assert.deepEqual(Object.keys(s.keysLost()), ["state", "released"]);
	assert.deepEqual(Object.keys(s.state), ["press", "gesture", "keys"]);
	const a = s.keyDown({ code: "KeyA" }), b = s.keyDown({ code: "KeyA" });
	assert.notEqual(a, b, "fresh each call");
	for (const outcome of [a, b, s.keyUp({ code: "KeyA" }), s.keysLost()]) assert.ok(isFrozenToDepth(outcome), describe(outcome));
	const fact = { code: "KeyQ" };
	s.keyDown(fact);
	assert.ok(!Object.isFrozen(fact), "the fact is not frozen, nor kept");
});

test("IB14: the keys held never change the press or the gesture, and no key operation makes a phase due", () => {
	const s = open();
	s.pointerDown({ at: { x: 1, y: 2 }, button: 0 });
	s.pressMatched({ id: "r", opens: "move" });
	const { press, gesture } = s.state;
	for (const outcome of [s.keyDown({ code: "KeyA" }), s.keyDown({ code: "KeyA" }), s.keyDown({ code: "" }), s.keyUp({ code: "KeyA" }), s.keyUp({ code: "KeyZ" }), s.keyDown({ code: "KeyB" }), s.keysLost()]) {
		assert.equal(outcome.state.press, press, "the very same press");
		assert.equal(outcome.state.gesture, gesture, "the very same gesture");
		assert.ok(!("phase" in outcome) && !("gesture" in outcome), "no phase");
	}
	s.keyDown({ code: "KeyC" });
	const keys = s.state.keys;
	for (const outcome of [s.pointerMove({ at: { x: 9, y: 9 } }), s.pointerUp({ button: 0 }), s.pointerDown({ at: { x: 0, y: 0 }, button: 0 }), s.pointerLost(), s.startGesture({ gesture: "move" }), s.cancelGesture()]) {
		assert.equal(outcome.state.keys, keys, "a pointer operation or a request keeps the very same keys");
	}
});

test("I16: a code of another type and an accessor code are refused before the state is read; a trap that calls the session takes effect first, and a refused operation changes nothing of its own", () => {
	const s = open();
	s.keyDown({ code: "KeyA" });
	const before = s.state;
	for (const code of [5, true, {}, undefined, Symbol("s"), 1n]) {
		malformed("keyDown", () => s.keyDown({ code }), String(typeof code));
		malformed("keyUp", () => s.keyUp({ code }), String(typeof code));
	}
	const accessor = Object.defineProperty({}, "code", { get: () => assert.fail("code's getter ran"), enumerable: true });
	malformed("keyDown", () => s.keyDown(accessor), "an accessor code");
	assert.equal(s.state, before, "nothing changed");
	// a trap that calls the session and then answers a malformed code: its own call stands, the refused keyUp changes nothing
	const refusedAfterTrap = new Proxy({ code: "KeyA" }, {
		getOwnPropertyDescriptor(target, key) {
			s.keyDown({ code: "KeyT" });
			return { value: 7, writable: true, enumerable: true, configurable: true };
		},
	});
	malformed("keyUp", () => s.keyUp(refusedAfterTrap), "a code its trap answers as 7");
	assert.deepEqual(s.state.keys, ["KeyA", "KeyT"], "the trap's keyDown stands; KeyA is not released");
	// a trap that calls keysLost and answers a code: the transition sees the state the trap left
	const lostThenDown = new Proxy({ code: "KeyA" }, {
		getOwnPropertyDescriptor(target, key) {
			s.keysLost();
			return Reflect.getOwnPropertyDescriptor(target, key);
		},
	});
	assert.deepEqual(s.keyDown(lostThenDown), { state: s.state, tracked: true, held: false }, "KeyA was held when the call began, and not after the trap ran");
	assert.deepEqual(s.state.keys, ["KeyA"]);
});

test("I16: over generated sequences of keyDown, keyUp and keysLost among pointer operations, codes '' and null among them, keys equal a model written apart, in order, and every outcome is as IB14 gives", () => {
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	const declaration = { threshold: 4, gestures: GESTURES };
	const CODES = ["KeyA", "KeyB", "ShiftLeft", "ControlLeft", "Digit1", "", "", null, null];
	const counts = { appended: 0, repeat: 0, removed: 0, unseen: 0, untracked: 0, lost: 0, lostEmpty: 0 };
	for (let n = 0; n < 500; n++) {
		const s = openGestureSession(declaration).session;
		let model = initialModel();
		for (let k = int(5, 60); k > 0; k--) {
			const op = chance(0.7) ? (chance(0.1) ? { kind: "keysLost" } : { kind: pick(["keyDown", "keyUp"]), code: pick(CODES) }) : randomOperation({ int, pick, chance }, GESTURES);
			const expected = modelStep(model, declaration, op);
			const before = s.state;
			if (expected.refused) {
				assert.throws(() => applyToSession(s, op), (e) => e.constructor === Error);
				continue;
			}
			const outcome = applyToSession(s, op);
			if (op.kind === "keyDown" || op.kind === "keyUp") {
				assert.deepEqual({ tracked: outcome.tracked, held: outcome.held }, expected.key, describe(op));
				assert.deepEqual(Object.keys(outcome), ["state", "tracked", "held"]);
				if (!outcome.tracked) counts.untracked++;
				else if (op.kind === "keyDown") counts[outcome.held ? "repeat" : "appended"]++;
				else counts[outcome.held ? "removed" : "unseen"]++;
				const unchanged = !outcome.tracked || (op.kind === "keyDown") === outcome.held;
				assert.equal(outcome.state === before, unchanged, "the very same state exactly when no code changed");
				assert.equal(outcome.state.keys === before.keys, unchanged);
			} else if (op.kind === "keysLost") {
				assert.equal(outcome.released, before.keys, "released is the very array held before");
				assert.equal(outcome.state === before, before.keys.length === 0);
				counts[before.keys.length === 0 ? "lostEmpty" : "lost"]++;
			} else {
				assert.equal(outcome.state.keys, before.keys, "a pointer operation keeps the very same keys");
			}
			if (op.kind === "keyDown" || op.kind === "keyUp" || op.kind === "keysLost") {
				assert.equal(outcome.state.press, before.press);
				assert.equal(outcome.state.gesture, before.gesture);
			}
			model = expected.model;
			assert.deepEqual(modelOf(s.state), model, describe(op));
		}
	}
	for (const [key, count] of Object.entries(counts)) assert.ok(count > 200, `${key}: ${count}`);
});
