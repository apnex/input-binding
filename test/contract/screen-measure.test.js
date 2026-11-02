// screen-measure - IB16, with IB1, IB2, IB9 and IB10 as the measure widens them (I20, I21): a session's declaration
// may name its measure, 'at' or 'screen', read after threshold and gestures and refused when malformed, the stored
// declaration 0.2.0's when it names none; and a session measured on screen reads each pointer fact's screen in the
// place of its at, and never its at -- a press's origin, state.press.at, a move's point and a restart's from are
// screen points, the threshold screen pixels -- so with at and screen differing, at a scale not 1 and a panned
// origin, a click, a drag returning to its start and a restart from a point are decided on screen, exactly.
import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";

import { openGestureSession } from "@apnex/input-binding";
import { nextUp, randomTools, seededRandom } from "../support/doubles.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { applyToSession, randomOperation } from "../support/lifecycle-model.js";
import { oracleBeyond } from "../support/travel-oracle.js";
import { recorded } from "../support/recording-proxy.js";

const GESTURES = [{ name: "move", engaged: true, button: null }, { name: "chain", engaged: true, button: 0 }];
const isTypeError = (fn) => (e) => Object.getPrototypeOf(e) === TypeError.prototype && e.message.startsWith(`${fn}: `);
const open = (declaration) => {
	const opened = openGestureSession(declaration);
	assert.equal(opened.ok, true, JSON.stringify(opened.problems));
	return opened.session;
};

/** A view of the drawing on the screen: screen = scale * at + pan, so at = (screen - pan) / scale. */
const viewOf = (scale, pan) => ({ atOf: (screen) => ({ x: (screen.x - pan.x) / scale, y: (screen.y - pan.y) / scale }) });
/** A pointer fact carrying both points, its at the drawing point under its screen point. */
const factAt = (view, screen, extra = {}) => ({ at: view.atOf(screen), screen, ...extra });

// ---- IB9: the declaration's measure ----

test("I20, IB2, IB9: measure's descriptor is read after threshold's and gestures', and its value after gestures is read whole", () => {
	const log = [];
	const gestures = recorded([recorded({ name: "move", engaged: true, button: null }, "gesture", log)], "gestures", log);
	const opened = openGestureSession(recorded({ threshold: 4, gestures, measure: "screen" }, "declaration", log));
	assert.equal(opened.ok, true);
	const ofDeclaration = log.filter((entry) => entry.startsWith("declaration "));
	assert.deepEqual(ofDeclaration, ["declaration getPrototypeOf", "declaration ownKeys", "declaration getOwnPropertyDescriptor threshold", "declaration getOwnPropertyDescriptor gestures", "declaration getOwnPropertyDescriptor measure"]);
	assert.ok(log.indexOf("declaration getOwnPropertyDescriptor measure") < log.indexOf("gestures getPrototypeOf"), "measure's descriptor among the declaration's, before gestures' value is read");
	// an accessor measure is refused by its descriptor, its getter never run
	let ran = false;
	const accessor = { threshold: 4, gestures: [] };
	Object.defineProperty(accessor, "measure", { get: () => ((ran = true), "screen"), enumerable: true });
	assert.deepEqual(openGestureSession(accessor).problems, [{ pointer: "/measure", problem: "invalid-value" }]);
	assert.equal(ran, false);
});

test("I20, IB9: measure is optional, 'at' or 'screen'; any other value, present as undefined, or an accessor is invalid-value at /measure, beside every other problem", () => {
	for (const [value, label] of [[1, "a number"], ["Screen", "another case"], ["", "empty"], [null, "null"], [undefined, "present as undefined"], [true, "a boolean"], [["screen"], "an array"]]) {
		assert.deepEqual(openGestureSession({ threshold: 4, gestures: [], measure: value }).problems, [{ pointer: "/measure", problem: "invalid-value" }], label);
	}
	assert.deepEqual(openGestureSession({ measure: "pixels" }).problems, [{ pointer: "/gestures", problem: "missing-property" }, { pointer: "/measure", problem: "invalid-value" }, { pointer: "/threshold", problem: "missing-property" }]);
	assert.deepEqual(openGestureSession({ threshold: -1, gestures: [], measure: "screen", extra: 1 }).problems, [{ pointer: "/extra", problem: "unknown-property" }, { pointer: "/threshold", problem: "invalid-value" }]);
	for (const measure of ["at", "screen"]) assert.equal(openGestureSession({ threshold: 4, gestures: [], measure }).ok, true, measure);
});

test("I20, IB9: session.declaration is { threshold, gestures } without measure, exactly 0.2.0's, and { threshold, gestures, measure } with it", () => {
	const without = open({ threshold: -0, gestures: GESTURES }).declaration;
	assert.deepEqual(Reflect.ownKeys(without), ["threshold", "gestures"]);
	assert.ok(Object.is(without.threshold, 0) && isFrozenToDepth(without));
	for (const measure of ["at", "screen"]) {
		const declared = open({ threshold: 4, gestures: GESTURES, measure }).declaration;
		assert.deepEqual(Reflect.ownKeys(declared), ["threshold", "gestures", "measure"], measure);
		assert.deepEqual(declared, { threshold: 4, gestures: GESTURES, measure });
		assert.ok(isFrozenToDepth(declared));
	}
});

// ---- IB16: measured on screen ----

test("I21, IB1, IB2, IB16: under 'screen' a Proxy fact records a read of screen in at's place, in IB2's order, and no read of at; under 'at' or none, no read of screen", () => {
	const reads = (measure, run) => {
		const session = open(measure === null ? { threshold: 4, gestures: GESTURES } : { threshold: 4, gestures: GESTURES, measure });
		const log = [];
		const fact = (extra) => recorded({ at: recorded({ x: 1, y: 2 }, "at", log), screen: recorded({ x: 10, y: 20 }, "screen", log), ...extra }, "fact", log);
		run(session, fact);
		return log;
	};
	const down = (s, fact) => s.pointerDown(fact({ button: 0, pointerId: 1 }));
	const move = (s, fact) => {
		s.pointerDown({ at: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, button: 0, pointerId: 1 });
		s.pointerMove(fact({ pointerId: 1 }));
	};
	const resolve = (s, fact) => s.resolvePress(fact({ button: 0 }), { match: () => null });
	const up = (s, fact) => s.pointerUp(fact({ button: 0 }));
	const order = (key) => ["fact getOwnPropertyDescriptor " + key, `${key} get x`, `${key} get y`];
	assert.deepEqual(reads("screen", down), [...order("screen"), "fact getOwnPropertyDescriptor button", "fact getOwnPropertyDescriptor pointerId"]);
	assert.deepEqual(reads("screen", move), [...order("screen"), "fact getOwnPropertyDescriptor pointerId"]);
	assert.deepEqual(reads("screen", resolve), [...order("screen"), "fact getOwnPropertyDescriptor button", "fact getOwnPropertyDescriptor pointerId"]);
	assert.deepEqual(reads("screen", up), ["fact getOwnPropertyDescriptor button", "fact getOwnPropertyDescriptor pointerId"], "a release reads no point either way");
	for (const measure of ["at", null]) {
		assert.deepEqual(reads(measure, down), [...order("at"), "fact getOwnPropertyDescriptor button", "fact getOwnPropertyDescriptor pointerId"], String(measure));
		assert.deepEqual(reads(measure, move), [...order("at"), "fact getOwnPropertyDescriptor pointerId"], String(measure));
	}
});

test("I21, IB1, IB16: under 'screen' a fact must hold screen, a point, as an own data property, its getter never run; its at may be anything or absent", () => {
	const session = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	let ran = false;
	const accessor = { at: { x: 0, y: 0 }, button: 0 };
	Object.defineProperty(accessor, "screen", { get: () => ((ran = true), { x: 0, y: 0 }), enumerable: true });
	const inherited = Object.create({ screen: { x: 0, y: 0 } });
	inherited.button = 0;
	for (const [fact, label] of [[{ at: { x: 0, y: 0 }, button: 0 }, "no screen"], [accessor, "an accessor screen"], [inherited, "an inherited screen"], [{ screen: { x: NaN, y: 0 }, button: 0 }, "a screen of no point"], [{ screen: () => {}, button: 0 }, "a function"], [{ screen: undefined, button: 0 }, "present as undefined"]]) {
		assert.throws(() => session.pointerDown(fact), isTypeError("pointerDown"), label);
		assert.throws(() => session.resolvePress(fact, { match: () => null }), isTypeError("resolvePress"), label);
	}
	assert.equal(ran, false);
	assert.equal(session.state.press, null, "nothing changed");
	const atAccessor = { screen: { x: 3, y: -0 }, button: 2 };
	Object.defineProperty(atAccessor, "at", { get: () => assert.fail("at's getter ran"), enumerable: true });
	session.pointerDown(atAccessor);
	assert.deepEqual(session.state.press, { at: { x: 3, y: 0 }, beyond: false, unmatched: true, button: 2, pointer: null }, "the press's origin the screen point, -0 written 0");
	assert.ok(Object.is(session.state.press.at.y, 0));
	assert.throws(() => session.pointerMove({ at: { x: 0, y: 0 } }), isTypeError("pointerMove"), "a move without screen");
	session.pointerMove({ screen: { x: 3, y: 4 } });
	assert.equal(session.state.press.beyond, false, "4 screen pixels is the threshold, a click");
});

test("I21, IB10, IB16: with at and screen differing -- a scale not 1, a panned origin -- a click, a drag returning to its start and a drop are decided on screen, where at would decide them otherwise", () => {
	for (const [scale, pan] of [[0.5, { x: 300, y: -120 }], [2, { x: -40.5, y: 17.25 }], [4, { x: 0, y: 1000 }]]) {
		const view = viewOf(scale, pan);
		const label = `scale ${scale}, pan ${JSON.stringify(pan)}`;
		const both = (measure) => open({ threshold: 4, gestures: GESTURES, measure });
		const start = { x: 200, y: 150 };
		// a travel of 3 screen pixels: a click on screen; at a scale of 0.5 it is 6 drawing units, a drop by at
		for (const [measure, screenTravel] of [["screen", 3], ["at", 3]]) {
			const s = both(measure);
			s.pointerDown(factAt(view, start, { button: 0 }));
			assert.deepEqual(s.state.press.at, measure === "screen" ? start : view.atOf(start), `${label}: the press's origin, state.press.at`);
			const moved = s.pointerMove(factAt(view, { x: start.x + screenTravel, y: start.y }));
			const trigger = s.pointerUp({ button: 0 }).trigger;
			const atUnits = screenTravel / scale;
			const expected = measure === "screen" ? "click" : atUnits > 4 ? "drop" : "click";
			assert.equal(trigger, expected, `${label}, ${measure}: a travel of ${screenTravel} screen pixels`);
			assert.equal(moved.crossed, expected === "drop");
		}
		// a drag returning to its start: 10 screen pixels out and back is a drop on screen, beyond sticking
		const drag = both("screen");
		drag.pointerDown(factAt(view, start, { button: 0 }));
		assert.equal(drag.pointerMove(factAt(view, { x: start.x + 10, y: start.y })).crossed, true, label);
		assert.equal(drag.pointerMove(factAt(view, start)).crossed, false);
		assert.equal(drag.pointerUp({ button: 0 }).trigger, "drop", `${label}: a drag back to its start is still a drop`);
		const byAt = both("at");
		byAt.pointerDown(factAt(view, start, { button: 0 }));
		byAt.pointerMove(factAt(view, { x: start.x + 10, y: start.y }));
		byAt.pointerMove(factAt(view, start));
		assert.equal(byAt.pointerUp({ button: 0 }).trigger, 10 / scale > 4 ? "drop" : "click", `${label}: by at, 10 screen pixels is ${10 / scale} units`);
		// a 5-pixel travel on screen, beyond its threshold of 4: a drop on screen at every scale, by at a drop only where 5 / scale > 4
		for (const measure of ["screen", "at"]) {
			const five = both(measure);
			five.pointerDown(factAt(view, start, { button: 0 }));
			five.pointerMove(factAt(view, { x: start.x + 3, y: start.y + 4 }));
			assert.equal(five.pointerUp({ button: 0 }).trigger, measure === "screen" || 5 / scale > 4 ? "drop" : "click", `${label}, ${measure}`);
		}
	}
});

test("I21, IB10, IB11, IB16: a restart's from is a screen point -- the press restarts there, not beyond, and its later travel is measured from it on screen", () => {
	const view = viewOf(2, { x: 50, y: 50 });
	const session = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	session.pointerDown(factAt(view, { x: 100, y: 100 }, { button: 0 }));
	session.pressMatched({ id: "r", opens: "move" });
	session.pointerMove(factAt(view, { x: 120, y: 100 }));
	assert.equal(session.state.press.beyond, true, "control: the press is a drag");
	session.becomeGesture({ gesture: "chain", from: { x: 120, y: 100 } });
	assert.deepEqual(session.state.press.at, { x: 120, y: 100 }, "restarted from the screen point, not beyond");
	assert.equal(session.state.press.beyond, false);
	assert.equal(session.pointerMove(factAt(view, { x: 123, y: 100 })).crossed, false, "3 screen pixels from the restart");
	assert.equal(session.pointerUp({ button: 0 }).trigger, "click");
	// handed the drawing point under it instead, the restart would measure from somewhere else: the caller converts first
	const wrong = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	wrong.pointerDown(factAt(view, { x: 100, y: 100 }, { button: 0 }));
	wrong.startGesture({ gesture: "move", from: view.atOf({ x: 120, y: 100 }) });
	assert.equal(wrong.pointerMove(factAt(view, { x: 123, y: 100 })).crossed, true, "a drawing point handed as from is far from the screen point");
	// under 'at', the same facts: the press's origin is the fact's at, and a restart's from an at point, measured on at
	const byAt = open({ threshold: 4, gestures: GESTURES, measure: "at" });
	byAt.pointerDown(factAt(view, { x: 100, y: 100 }, { button: 0 }));
	assert.deepEqual(byAt.state.press.at, view.atOf({ x: 100, y: 100 }), "the press's origin the fact's at");
	byAt.pressMatched({ id: "r", opens: "move" });
	byAt.becomeGesture({ gesture: "chain", from: view.atOf({ x: 120, y: 100 }) });
	assert.deepEqual(byAt.state.press.at, { x: 35, y: 25 }, "restarted from the at point");
	assert.equal(byAt.pointerMove(factAt(view, { x: 123, y: 100 })).crossed, false, "1.5 units from the restart");
	assert.equal(byAt.pointerMove(factAt(view, { x: 129, y: 100 })).crossed, true, "4.5 units from it, though 9 screen pixels");
	// startGesture's from likewise, and resolvePress's press origin the fact's screen
	const resolved = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	const outcome = resolved.resolvePress(factAt(view, { x: 7, y: 9 }, { button: 0 }), { match: () => ({ id: "r", opens: "move" }) });
	assert.equal(outcome.phase, "start");
	assert.deepEqual(resolved.state.press.at, { x: 7, y: 9 });
	resolved.cancelGesture();
	resolved.startGesture({ gesture: "move", from: { x: 30, y: 40 } });
	assert.deepEqual(resolved.state.press.at, { x: 30, y: 40 });
});

test("I21, IB10, IB16: a press's travel measured on screen decides click and drop exactly -- equal to the threshold a click, one binary64 step past it a drop, and the exact oracle over random screen travels, whatever the facts' at", () => {
	const session = () => open({ threshold: 4, gestures: [], measure: "screen" });
	const travel = (x0, y0, x1, y1) => {
		const s = session();
		s.pointerDown({ screen: { x: x0, y: y0 }, at: { x: 1e9, y: -1e9 }, button: 0 });
		s.pointerMove({ screen: { x: x1, y: y1 }, at: { x: -1e9, y: 1e9 } });
		return s.pointerUp({ button: 0 }).trigger;
	};
	assert.equal(travel(10, 10, 10, 14), "click", "exactly the threshold");
	assert.equal(travel(10, 10, 10, nextUp(14)), "drop", "one step past it");
	assert.equal(travel(-3, 0, 0, 4), "drop", "a 3-4-5 travel of 5");
	const { pick } = randomTools(seededRandom());
	const rnd = seededRandom(7);
	let compared = 0;
	for (let n = 0; n < 2000; n++) {
		const x0 = (rnd() - 0.5) * 2000, y0 = (rnd() - 0.5) * 2000;
		const angle = rnd() * 7, r = 4 * (1 + pick([-1e-15, -1e-16, 0, 1e-16, 1e-15, 0.01, -0.01]));
		const x1 = x0 + r * Math.cos(angle), y1 = y0 + r * Math.sin(angle);
		assert.equal(travel(x0, y0, x1, y1), oracleBeyond(x0, y0, x1, y1, 4) ? "drop" : "click", JSON.stringify([x0, y0, x1, y1]));
		compared++;
	}
	assert.equal(compared, 2000);
});

test("I21, IB16: over I10's generator, a session declared with measure 'at' answers as one declared without it, and one declared with 'screen', handed facts whose screen is the other's at and whose at is elsewhere, answers the same states and outcomes", () => {
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	const applyScreen = (session, op) => {
		const pointer = op.pointer === undefined ? {} : { pointerId: op.pointer };
		if (op.kind === "down") return session.pointerDown({ screen: { x: op.x, y: op.y }, at: { x: op.x * 3 + 7, y: -op.y }, button: op.button, ...pointer });
		if (op.kind === "move") return session.pointerMove({ screen: { x: op.x, y: op.y }, at: { x: 1e6, y: op.x }, ...pointer });
		return applyToSession(session, op);
	};
	const run = (session, apply, op) => {
		try {
			return { outcome: JSON.stringify(apply(session, op)) };
		} catch (error) {
			return { refused: error.constructor.name };
		}
	};
	let compared = 0;
	for (let n = 0; n < 300; n++) {
		const none = open({ threshold: 4, gestures: GESTURES });
		const at = open({ threshold: 4, gestures: GESTURES, measure: "at" });
		const screen = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
		for (let k = int(5, 40); k > 0; k--) {
			const op = randomOperation({ int, pick, chance }, GESTURES);
			if (chance(0.5)) op.pointer = pick([1, 2]);
			const before = [none.state, at.state, screen.state];
			const a = run(none, applyToSession, op);
			assert.deepEqual(run(at, applyToSession, op), a, JSON.stringify(op));
			assert.deepEqual(run(screen, applyScreen, op), a, JSON.stringify(op));
			const same = (s, i) => [s.state === before[i], s.state.press === before[i].press, s.state.press?.at === before[i].press?.at];
			assert.deepEqual(same(at, 1), same(none, 0), JSON.stringify(op));
			assert.deepEqual(same(screen, 2), same(none, 0), JSON.stringify(op));
			compared++;
		}
	}
	assert.ok(compared > 5000, `${compared} compared`);
});

test("I21, IB2 rule 5, IB16: a screen point is of any prototype -- a class whose x and y are getters, as a DOMPoint's, another realm's object -- and so is a fact; a declaration of another realm is refused at \"\" alone, as 0.2.0 refuses it", () => {
	class ScreenPoint {
		#x;
		#y;
		constructor(x, y) {
			this.#x = x;
			this.#y = y;
		}
		get x() {
			return this.#x;
		}
		get y() {
			return this.#y;
		}
	}
	const session = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	session.pointerDown({ screen: new ScreenPoint(5, 6), button: 0 });
	assert.deepEqual(session.state.press.at, { x: 5, y: 6 });
	session.pointerMove(vm.runInNewContext("({ screen: { x: 5, y: 10.5 }, pointerId: null })"));
	assert.equal(session.state.press.beyond, true, "another realm's fact and point, 4.5 screen pixels away");
	session.startGesture({ gesture: "move", from: vm.runInNewContext("({ x: -1, y: -2 })") });
	assert.deepEqual(session.state.press.at, { x: -1, y: -2 });
	assert.deepEqual(openGestureSession(vm.runInNewContext("({ threshold: 4, gestures: [], measure: 'screen' })")).problems, [{ pointer: "", problem: "not-an-object" }]);
	for (const measure of [new String("screen"), Object("at"), vm.runInNewContext("new String('screen')")]) {
		assert.deepEqual(openGestureSession({ threshold: 4, gestures: [], measure }).problems, [{ pointer: "/measure", problem: "invalid-value" }], "a String object is no string");
	}
});

test("I21, IB12, IB16: under 'screen' identity is decided by the screen point alone -- a press at its own screen point is the very same state whatever its at; a press or a restart at another screen point a new one", () => {
	const session = open({ threshold: 4, gestures: GESTURES, measure: "screen" });
	session.pointerDown({ screen: { x: 1, y: 2 }, at: { x: 10, y: 20 }, button: 0 });
	const state = session.state;
	assert.equal(session.pointerDown({ screen: { x: 1, y: 2 }, at: { x: -7, y: 3 }, button: 0 }).state, state, "another at, the same screen point: the very same state");
	assert.equal(session.pointerDown({ screen: { x: 1, y: 2 }, button: 0 }).state, state, "no at at all");
	session.startGesture({ gesture: "move", from: { x: 1, y: 2 } });
	assert.equal(session.state.press, state.press, "a restart from the press's own screen point keeps the press");
	const moved = session.pointerDown({ screen: { x: 1, y: 3 }, at: { x: 10, y: 20 }, button: 0 });
	assert.notEqual(moved.state.press, state.press, "the same at, another screen point: a new press");
	assert.notEqual(moved.state.press.at, state.press.at);
});
