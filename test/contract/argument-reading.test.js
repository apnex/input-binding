// argument-reading - IB1 and IB2 (I8, I11): binding reads no property of a fact but at and button, each only
// in the operations IB1 names, in IB2's order, and writes none; every operation reads its arguments in the
// order IB2's table gives, and a malformed argument at each place stops the reading there.
import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBindingTable, openGestureSession } from "@apnex/input-binding";
import { phantom, recorded } from "../support/recording-proxy.js";

const GESTURES = [{ name: "move", engaged: true, button: null }, { name: "chain", engaged: true, button: 0 }];
const open = () => openGestureSession({ threshold: 4, gestures: GESTURES }).session;
const malformed = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);
const noGetter = (name) => ({ get: () => assert.fail(`the getter of ${name} ran`), enumerable: true, configurable: true });

/** A browser's DOMPoint as draw holds one: x and y are getters on its prototype. */
class PointWithGetters {
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

test("I8: a Proxy fact records every read -- pointerDown reads at, its x and y, then button; pointerMove at; pointerUp button -- and nothing is written", () => {
	const s = open();
	const cases = [
		["pointerDown", (f) => s.pointerDown(f), ["fact getOwnPropertyDescriptor at", "at get x", "at get y", "fact getOwnPropertyDescriptor button"]],
		["pointerMove", (f) => s.pointerMove(f), ["fact getOwnPropertyDescriptor at", "at get x", "at get y"]],
		["pointerUp", (f) => s.pointerUp(f), ["fact getOwnPropertyDescriptor button"]],
		["pointerLost", (f) => s.pointerLost(f), []],
		["cancelGesture", (f) => s.cancelGesture(f), []],
	];
	for (const [fn, call, expected] of cases) {
		const log = [];
		const fact = recorded({ at: recorded({ x: 1, y: 2 }, "at", log), button: 0, key: "k", on: { kind: "thing" } }, "fact", log);
		call(fact);
		assert.deepEqual(log, expected, fn);
	}
});

test("I8: the table never reads a fact or a context -- it hands each to the predicates, unread", () => {
	const log = [];
	const fact = recorded({ at: { x: 0, y: 0 }, button: 0 }, "fact", log);
	const context = recorded({ s: 1 }, "context", log);
	const { table } = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "x", on: (f) => f === fact, when: (c) => c === context }, { id: "y", on: () => true }] }] });
	table.traceInput(fact, context);
	table.matchInput(fact, context);
	table.findOverlaps([fact], [context], [{}]);
	assert.deepEqual(log, []);
});

test("I8: an accessor or inherited at or button is refused with no getter called; a function is neither a fact nor a point", () => {
	const s = open();
	malformed("pointerDown", () => s.pointerDown(Object.defineProperty({ button: 0 }, "at", noGetter("at"))), "an accessor at");
	malformed("pointerDown", () => s.pointerDown(Object.defineProperty({ at: { x: 0, y: 0 } }, "button", noGetter("button"))), "an accessor button");
	malformed("pointerUp", () => s.pointerUp(Object.defineProperty({}, "button", noGetter("button"))), "an accessor button");
	malformed("pointerMove", () => s.pointerMove(Object.defineProperty({}, "at", noGetter("at"))), "an accessor at");
	malformed("pointerDown", () => s.pointerDown(Object.create({ at: { x: 0, y: 0 }, button: 0 })), "an inherited at");
	malformed("pointerUp", () => s.pointerUp(Object.create({ button: 0 })), "an inherited button");
	const asFunction = Object.assign(() => 0, { at: { x: 0, y: 0 }, button: 0 });
	malformed("pointerDown", () => s.pointerDown(asFunction), "a function as a fact");
	malformed("pointerUp", () => s.pointerUp(asFunction), "a function as a fact");
	malformed("pointerDown", () => s.pointerDown({ at: Object.assign(() => 0, { x: 0, y: 0 }), button: 0 }), "a function as a point");
	malformed("startGesture", () => s.startGesture({ gesture: "move", from: Object.assign(() => 0, { x: 0, y: 0 }) }), "a function as a point");
});

test("I8: frozen facts, contexts, rows and guard states are accepted; a fact of any prototype; a point whose x and y are getters", () => {
	const row = Object.freeze({ id: "x", on: (f) => f.button === 0, when: (c) => c.ok, quiet: true });
	const { table } = composeBindingTable({ guards: [{ state: "busy", flag: "quiet", default: false, refuses: "state-without-flag" }], tenants: [{ owner: "a", rows: [row] }] });
	const fact = Object.freeze({ at: Object.freeze({ x: 1, y: 1 }), button: 0 });
	const context = Object.freeze({ ok: true });
	const guards = Object.freeze({ busy: true });
	assert.equal(table.matchInput(fact, context, guards).match.row, row);
	assert.equal(table.findOverlaps(Object.freeze([fact]), Object.freeze([context]), Object.freeze([guards])).length, 0);
	const s = open();
	s.pointerDown(fact);
	class Event {
		constructor() {
			this.at = new PointWithGetters(5, 6);
			this.button = 0;
		}
	}
	s.pointerDown(new Event());
	assert.deepEqual(s.state.press.at, { x: 5, y: 6 }, "a point's getters answer");
	s.pointerDown(Object.assign(Object.create(null), { at: Object.assign(Object.create(null), { x: 7, y: 8 }), button: 0 }));
	assert.deepEqual(s.state.press.at, { x: 7, y: 8 });
	assert.ok(Object.isFrozen(fact) && !Object.isFrozen(new Event()), "nothing frozen that was not");
});

test("IB2: pressMatched reads the match's prototype, its id, its opens -- never its own keys, owner or row", () => {
	const s = open();
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	const log = [];
	s.pressMatched(recorded({ id: "x", owner: "o", opens: "move", row: {} }, "match", log));
	assert.deepEqual(log, ["match getPrototypeOf", "match getOwnPropertyDescriptor id", "match getOwnPropertyDescriptor opens"]);
});

test("IB2: startGesture and becomeGesture read the argument's prototype and own keys, its gesture, row and from by descriptor, then from's x and y", () => {
	const s = open();
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	const log = [];
	s.startGesture(recorded({ from: recorded({ x: 1, y: 1 }, "from", log), row: "r", gesture: "move" }, "args", log));
	assert.deepEqual(log, ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture", "args getOwnPropertyDescriptor row", "args getOwnPropertyDescriptor from", "from get x", "from get y"]);
	log.length = 0;
	s.becomeGesture(recorded({ from: recorded({ x: 2, y: 2 }, "from", log), gesture: "chain" }, "args", log));
	assert.deepEqual(log, ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture", "args getOwnPropertyDescriptor from", "from get x", "from get y"]);
	log.length = 0;
	s.cancelGesture();
	s.startGesture(recorded({ gesture: "move" }, "args", log));
	assert.deepEqual(log, ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture"], "an absent property's descriptor is not read");
});

/** The reads an operation made before it threw a TypeError beginning with its name. */
function readsBeforeRefusal(fn, call) {
	const log = [];
	malformed(fn, () => call(log), "its argument");
	return log;
}

test("I11: for each operation, a malformed argument at each place in IB2's order stops the reading there, no later getter or trap called", () => {
	const s = open();
	const point = (log, x, y = 0) => recorded({ x, y }, "point", log);
	// pointerDown: the fact; its at; that point's x and y; the fact's button
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded(Object.defineProperty({ button: 0 }, "at", noGetter("at")), "fact", log))), ["fact getOwnPropertyDescriptor at"]);
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ button: 0 }, "fact", log))), ["fact getOwnPropertyDescriptor at"], "at absent");
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ at: null, button: 0 }, "fact", log))), ["fact getOwnPropertyDescriptor at"]);
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ at: point(log, NaN), button: 0 }, "fact", log))), ["fact getOwnPropertyDescriptor at", "point get x", "point get y"], "a NaN x has its y read, then throws");
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ at: point(log, 0, "0"), button: 0 }, "fact", log))), ["fact getOwnPropertyDescriptor at", "point get x", "point get y"]);
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ at: point(log, 0), button: 0.5 }, "fact", log))), ["fact getOwnPropertyDescriptor at", "point get x", "point get y", "fact getOwnPropertyDescriptor button"]);
	const xThrows = (log) => recorded({ x: 0, y: 0 }, "point", log, { get: (t, k) => {
		if (k === "x") throw new Error("x");
		return t[k];
	} });
	assert.deepEqual(readsBeforeRefusal("pointerDown", (log) => s.pointerDown(recorded({ at: xThrows(log), button: 0 }, "fact", log))), ["fact getOwnPropertyDescriptor at", "point get x"], "a throwing x getter: y never read");
	// pointerMove: the fact; its at; that point's x and y
	assert.deepEqual(readsBeforeRefusal("pointerMove", (log) => s.pointerMove(recorded({ at: point(log, 0, Infinity) }, "fact", log))), ["fact getOwnPropertyDescriptor at", "point get x", "point get y"]);
	assert.deepEqual(readsBeforeRefusal("pointerMove", () => s.pointerMove(5)), []);
	// pointerUp: the fact; its button
	assert.deepEqual(readsBeforeRefusal("pointerUp", (log) => s.pointerUp(recorded({ button: "0" }, "fact", log))), ["fact getOwnPropertyDescriptor button"]);
	assert.deepEqual(readsBeforeRefusal("pointerUp", () => s.pointerUp(null)), []);
	// pressMatched: the match's prototype; its id; its opens
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	assert.deepEqual(readsBeforeRefusal("pressMatched", (log) => s.pressMatched(recorded(Object.create({}), "match", log))), ["match getPrototypeOf"]);
	assert.deepEqual(readsBeforeRefusal("pressMatched", (log) => s.pressMatched(recorded({ id: "", opens: null }, "match", log))), ["match getPrototypeOf", "match getOwnPropertyDescriptor id"]);
	assert.deepEqual(readsBeforeRefusal("pressMatched", (log) => s.pressMatched(recorded({ id: "x", opens: "nope" }, "match", log))), ["match getPrototypeOf", "match getOwnPropertyDescriptor id", "match getOwnPropertyDescriptor opens"]);
	// startGesture: the argument's prototype and own keys; its gesture, row and from; that point's x and y
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded([], "args", log))), ["args getPrototypeOf"]);
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded({ gesture: "move", from: point(log, 0), extra: 1 }, "args", log))), ["args getPrototypeOf", "args ownKeys"]);
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded({ gesture: "nope", row: "r", from: point(log, 0) }, "args", log))), ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture"], "an undeclared gesture throws before from is read");
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded({ gesture: "move", row: null, from: point(log, 0) }, "args", log))), ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture", "args getOwnPropertyDescriptor row"]);
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded(Object.defineProperty({ gesture: "move" }, "from", noGetter("from")), "args", log))), ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture", "args getOwnPropertyDescriptor from"]);
	assert.deepEqual(readsBeforeRefusal("startGesture", (log) => s.startGesture(recorded({ gesture: "move", from: point(log, NaN) }, "args", log))), ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture", "args getOwnPropertyDescriptor from", "point get x", "point get y"]);
	// becomeGesture: as startGesture, with no row
	s.startGesture({ gesture: "move" });
	assert.deepEqual(readsBeforeRefusal("becomeGesture", (log) => s.becomeGesture(recorded({ gesture: "move", row: "r" }, "args", log))), ["args getPrototypeOf", "args ownKeys"], "row given to becomeGesture is malformed at its keys");
	assert.deepEqual(readsBeforeRefusal("becomeGesture", (log) => s.becomeGesture(recorded({ gesture: 1, from: point(log, 0) }, "args", log))), ["args getPrototypeOf", "args ownKeys", "args getOwnPropertyDescriptor gesture"]);
});

test("IB2: a phantom key -- listed by its own keys, its descriptor undefined -- is absent where IB2's order reads its descriptor, and known by its key alone where it reads none", () => {
	const s = open();
	malformed("pointerDown", () => s.pointerDown(phantom({ button: 0 }, "at")), "a phantom at");
	malformed("pointerUp", () => s.pointerUp(phantom({}, "button")), "a phantom button");
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	malformed("pressMatched", () => s.pressMatched(phantom({ opens: null }, "id")), "a phantom id");
	malformed("pressMatched", () => s.pressMatched(phantom({ id: "x" }, "opens")), "a phantom opens");
	malformed("startGesture", () => s.startGesture(phantom({}, "gesture")), "a phantom gesture");
	const log = [];
	malformed("startGesture", () => s.startGesture(recorded(phantom({ gesture: "move" }, "extra"), "args", log)), "a phantom key the form does not name");
	assert.deepEqual(log, ["args getPrototypeOf", "args ownKeys"], "known by its key alone, as IB2's table reads no descriptor of it");
	const started = s.startGesture(phantom({ gesture: "move" }, "row", "from"));
	assert.equal(started.gesture.row, null, "a phantom row is absent");
	assert.deepEqual(s.state.press.at, { x: 0, y: 0 }, "a phantom from is absent: no restart");
	malformed("becomeGesture", () => s.becomeGesture(phantom({ gesture: "chain" }, "row")), "row is no key of becomeGesture's form, phantom or not");
	const { table } = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "x", on: () => true }] }] });
	malformed("findOverlaps", () => table.findOverlaps(phantom([, 1], "0"), [], []), "a phantom index, a hole");
	malformed("findOverlaps", () => table.findOverlaps([], phantom([], "extra"), []), "a phantom key that is no index");
});

test("IB2 rule 9: an operation that throws while reading changes nothing itself, and reads the session's state only after its arguments", () => {
	const s = open();
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	const before = s.state;
	malformed("pointerDown", () => s.pointerDown({ at: { x: 1, y: 1 }, button: NaN }), "a NaN button");
	assert.equal(s.state, before, "the at it had read is not kept");
	malformed("becomeGesture", () => s.becomeGesture({ gesture: "move" , from: { x: 1, y: null } }), "a null y");
	assert.equal(s.state, before);
});
