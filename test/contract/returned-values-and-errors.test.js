// returned-values-and-errors - CONTRACT.md's "Errors" and "What is returned": each function refusing each
// malformed argument with a TypeError whose message begins with its name, a getter's or trap's error
// rethrown as that TypeError, the lifecycle's refusals an Error of the base constructor; every answer made
// afresh and frozen to its depth, down to but not into the caller's values; and no argument frozen.
import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBindingTable, openGestureSession } from "@apnex/input-binding";
import { isFrozenToDepth } from "../support/frozen.js";
import { revoked, trapping } from "../support/recording-proxy.js";

const GUARD = { state: "busy", flag: "quiet", default: false, refuses: "state-without-flag" };
const row = { id: "x", on: () => true, payload: { deep: [1] } };
const table = composeBindingTable({ guards: [GUARD], claim: { flag: "c", default: true }, opens: { field: "opens" }, tenants: [{ owner: "a", rows: [row] }] }).table;
const open = () => openGestureSession({ threshold: 4, gestures: [{ name: "move", engaged: true, button: null }] }).session;
const refuses = (fn, call, label) =>
	assert.throws(call, (e) => {
		assert.ok(e instanceof TypeError, `${fn} throws a TypeError for ${label}, not ${e?.constructor?.name}`);
		assert.ok(e.message.startsWith(fn), `the message begins with ${fn}: ${e.message}`);
		return true;
	});

const show = (v) => {
	try {
		return JSON.stringify(v) ?? String(v);
	} catch {
		return "a value that cannot be shown";
	}
};
const throwingGetter = (name) => Object.defineProperty({}, name, { get() {
	throw new RangeError("the getter's own");
}, enumerable: true });

test("Errors: composeBindingTable and openGestureSession never throw, for any argument", () => {
	const values = [undefined, null, 0, NaN, "", "x", true, Symbol("s"), 1n, [], {}, () => ({}), new Proxy({}, { getPrototypeOf() {
		throw new Error("trap");
	} }), revoked({}), revoked([]), trapping({ tenants: [] }, "ownKeys"), throwingGetter("tenants"), throwingGetter("threshold"), { tenants: [{ owner: "a", rows: [throwingGetter("id")] }] }, { threshold: 4, gestures: [throwingGetter("name")] }];
	for (const value of values) {
		assert.doesNotThrow(() => composeBindingTable(value));
		assert.doesNotThrow(() => openGestureSession(value));
		assert.equal(composeBindingTable(value).ok, false);
		assert.equal(openGestureSession(value).ok, false);
	}
});

test("Errors: every malformed argument of a table's functions throws a TypeError beginning with the function's name", () => {
	for (const guards of [null, 5, "busy", [], { busy: 1 }, { idle: true }, throwingGetter("busy"), revoked({}), trapping({}, "ownKeys"), trapping({ busy: true }, "getOwnPropertyDescriptor")]) {
		refuses("traceInput", () => table.traceInput(1, 2, guards), String(typeof guards));
		refuses("matchInput", () => table.matchInput(1, 2, guards), String(typeof guards));
	}
	for (const [facts, contexts, guardStates] of [[undefined, [], []], [[], null, []], [[], [], undefined], [revoked([]), [], []], [[], [], [revoked({})]], [[], [], [{ busy: "no" }]], [new Array(2), [], []]]) {
		refuses("findOverlaps", () => table.findOverlaps(facts, contexts, guardStates), "a malformed list");
	}
});

test("Errors: every malformed argument of a session's operations throws a TypeError beginning with the operation's name", () => {
	const s = open();
	const badFacts = [undefined, null, 5, "f", () => ({}), {}, { at: null, button: 0 }, { at: { x: 0 }, button: 0 }, { at: { x: 0, y: NaN }, button: 0 }, { at: { x: "0", y: 0 }, button: 0 }, { at: { x: 0, y: 0 }, button: "0" }, { at: { x: 0, y: 0 }, button: 1.5 }, { at: { x: 0, y: 0 }, button: 2 ** 53 }, { at: { x: 0, y: 0 } }, revoked({}), throwingGetter("at"), { at: throwingGetter("x"), button: 0 }];
	for (const f of badFacts) refuses("pointerDown", () => s.pointerDown(f), show(f));
	for (const f of [undefined, null, {}, { at: { x: Infinity, y: 0 } }, { at: 5 }, { at: throwingGetter("y") }, revoked({})]) refuses("pointerMove", () => s.pointerMove(f), show(f));
	for (const f of [undefined, null, {}, { button: null }, { button: -0.5 }, revoked({}), throwingGetter("button")]) refuses("pointerUp", () => s.pointerUp(f), show(f));
	s.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	for (const m of [undefined, null, {}, { id: "x", opens: "zoom" }, revoked({}), trapping({ id: "x", opens: null }, "getOwnPropertyDescriptor")]) refuses("pressMatched", () => s.pressMatched(m), show(m));
	for (const a of [undefined, {}, { gesture: "zoom" }, { gesture: "move", row: null }, revoked({}), trapping({ gesture: "move" }, "ownKeys"), { gesture: "move", from: throwingGetter("x") }]) {
		refuses("startGesture", () => s.startGesture(a), show(a));
		refuses("becomeGesture", () => s.becomeGesture(a), show(a));
	}
});

test("Errors: a getter's or a Proxy trap's error, met while an argument is read, is rethrown as the function's own TypeError", () => {
	const s = open();
	const cases = [
		["pointerDown", () => s.pointerDown({ at: throwingGetter("x"), button: 0 })],
		["pointerMove", () => s.pointerMove(trapping({ at: { x: 0, y: 0 } }, "getOwnPropertyDescriptor"))],
		["matchInput", () => table.matchInput(0, 0, trapping({}, "getPrototypeOf"))],
		["findOverlaps", () => table.findOverlaps(trapping([], "ownKeys"), [], [])],
	];
	for (const [fn, call] of cases) {
		assert.throws(call, (e) => e instanceof TypeError && !(e instanceof RangeError) && e.message.startsWith(`${fn}:`), fn);
	}
});

test("Errors: an operation the session's state does not allow throws an Error of the base constructor, beginning with its name, and changes nothing; a malformed argument is refused first", () => {
	const s = open();
	const empty = s.state;
	for (const [fn, call] of [["pressMatched", () => s.pressMatched({ id: "x", opens: null })], ["becomeGesture", () => s.becomeGesture({ gesture: "move" })]]) {
		assert.throws(call, (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith(`${fn}:`), fn);
		assert.equal(s.state, empty);
	}
	s.startGesture({ gesture: "move" });
	const live = s.state;
	assert.throws(() => s.startGesture({ gesture: "move" }), (e) => Object.getPrototypeOf(e) === Error.prototype && e.message.startsWith("startGesture:"));
	assert.equal(s.state, live);
	refuses("startGesture", () => s.startGesture({ gesture: "zoom" }), "a malformed argument while the state also refuses");
	const fresh = open();
	refuses("pressMatched", () => fresh.pressMatched({}), "a malformed match with no press");
	refuses("becomeGesture", () => fresh.becomeGesture({ gesture: "zoom" }), "a malformed argument with none live");
});

test("Errors: an exception a predicate throws propagates unchanged, and the call leaves nothing behind", () => {
	const thrown = new SyntaxError("the predicate's");
	const t = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "x", on: () => {
		throw thrown;
	} }] }] }).table;
	for (const call of [() => t.traceInput(0, 0), () => t.matchInput(0, 0), () => t.findOverlaps([0], [0], [{}])]) assert.throws(call, (e) => e === thrown);
});

test("What is returned: every answer is fresh and frozen to its depth, down to but not into the caller's values, which are returned by reference", () => {
	const fact = { at: { x: 1, y: 1 }, button: 0 }, context = { ok: true }, guards = { busy: false };
	const callers = new Set([row, row.on, row.payload, fact, context, guards]);
	const composed = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "a", rows: [row] }] });
	assert.ok(isFrozenToDepth(composed, callers));
	assert.ok(isFrozenToDepth(composeBindingTable({ tenants: 5 }), callers));
	assert.ok(isFrozenToDepth(openGestureSession(null), callers));
	const answers = [table.traceInput(fact, context, guards), table.matchInput(fact, context, guards), table.findOverlaps([fact, fact], [context], [guards])];
	for (const answer of answers) assert.ok(isFrozenToDepth(answer, callers));
	assert.notEqual(table.matchInput(fact, context), table.matchInput(fact, context), "a fresh answer each call");
	assert.equal(table.matchInput(fact, context).match.row, row);
	const s = open();
	for (const outcome of [s.pointerDown(fact), s.pressMatched({ id: "x", opens: "move" }), s.pointerMove(fact), s.becomeGesture({ gesture: "move" }), s.pointerUp(fact), s.startGesture({ gesture: "move", row: "r" }), s.cancelGesture(), s.pointerLost()]) {
		assert.ok(isFrozenToDepth(outcome));
	}
	assert.ok(isFrozenToDepth(s.state) && isFrozenToDepth(s.declaration));
	for (const value of [row, row.payload, row.payload.deep, fact, fact.at, context, guards]) assert.ok(!Object.isFrozen(value), "no argument frozen");
	assert.deepEqual(row, { id: "x", on: row.on, payload: { deep: [1] } }, "no argument changed");
	assert.deepEqual(fact, { at: { x: 1, y: 1 }, button: 0 });
});
