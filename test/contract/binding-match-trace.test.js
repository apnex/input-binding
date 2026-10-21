// binding-match-trace - IB6 (I6): for every row, in table order, how far it matched one input, computed in
// three passes -- guards, then every admitted row's on, then every bound row's when -- each predicate
// called once, with no receiver and one argument, its answer taken as `if` takes it.
import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBindingTable } from "@apnex/input-binding";
import { isFrozenToDepth } from "../support/frozen.js";

const GUARDS = [
	{ state: "busy", flag: "quiet", default: false, refuses: "state-without-flag" },
	{ state: "busy", flag: "loud", default: true, refuses: "state-and-flag" },
	{ state: "locked", flag: "writes", default: true, refuses: "state-and-flag" },
];

test("IB6: the record of each row -- refused, unbound, unmet, a hit -- with its keys in order", () => {
	const rows = [
		{ id: "refused", on: () => true },
		{ id: "unbound", on: () => false, quiet: true, loud: false },
		{ id: "unmet", on: () => true, when: () => false, quiet: true, loud: false },
		{ id: "hit", on: () => true, when: () => true, quiet: true, loud: false },
		{ id: "always", on: () => true, quiet: true, loud: false },
	];
	const { table } = composeBindingTable({ guards: GUARDS, tenants: [{ owner: "a", rows: rows.slice(0, 3) }, { owner: "b", rows: rows.slice(3) }] });
	const trace = table.traceInput("fact", "context", { busy: true });
	assert.deepEqual(trace, [
		{ id: "refused", owner: "a", refusedBy: "quiet", on: null, when: null, hit: false },
		{ id: "unbound", owner: "a", refusedBy: null, on: false, when: null, hit: false },
		{ id: "unmet", owner: "a", refusedBy: null, on: true, when: false, hit: false },
		{ id: "hit", owner: "b", refusedBy: null, on: true, when: true, hit: true },
		{ id: "always", owner: "b", refusedBy: null, on: true, when: true, hit: true },
	]);
	for (const record of trace) assert.deepEqual(Object.keys(record), ["id", "owner", "refusedBy", "on", "when", "hit"]);
	assert.ok(isFrozenToDepth(trace));
	assert.notEqual(table.traceInput("fact", "context", { busy: true }), trace, "a fresh trace each call");
});

test("IB6: a row refused by two guards names the first, in declaration order", () => {
	const { table } = composeBindingTable({ guards: GUARDS, tenants: [{ owner: "a", rows: [{ id: "x", on: () => true, loud: true }] }] });
	assert.equal(table.traceInput(null, null, { busy: true, locked: true })[0].refusedBy, "quiet");
	assert.equal(table.traceInput(null, null, { busy: false, locked: true })[0].refusedBy, "writes");
	const second = composeBindingTable({ guards: [GUARDS[2], GUARDS[0]], tenants: [{ owner: "a", rows: [{ id: "x", on: () => true }] }] }).table;
	assert.equal(second.traceInput(null, null, { busy: true, locked: true })[0].refusedBy, "writes");
});

test("IB6: an answer is taken as `if` takes it -- 0, '' and null are no, an object and a non-empty string yes", () => {
	const answers = [0, "", null, undefined, NaN, 0n, false, {}, [], "0", 1, -1, 1n, true, () => 0];
	const rows = answers.map((a, i) => ({ id: `on${i}`, on: () => a }));
	const whenRows = answers.map((a, i) => ({ id: `when${i}`, on: () => 1, when: () => a }));
	const { table } = composeBindingTable({ tenants: [{ owner: "a", rows: [...rows, ...whenRows] }] });
	const trace = table.traceInput(null, null);
	answers.forEach((a, i) => {
		const yes = a ? true : false;
		assert.equal(trace[i].on, yes, `on answering ${String(a)}`);
		assert.equal(trace[answers.length + i].when, yes, `when answering ${String(a)}`);
	});
});

test("I6: spies count every call, its order and its receiver -- each admitted row's on once, each reached row's when once, every on before any when, each in table order", () => {
	const calls = [];
	const spy = (name, answer) => function (...args) {
		calls.push({ name, args, self: this });
		return answer;
	};
	const rows = [
		{ id: "a", on: spy("on a", true), when: spy("when a", true), quiet: true },
		{ id: "b", on: spy("on b", true), when: spy("when b", false) },
		{ id: "c", on: spy("on c", false), when: spy("when c", true), quiet: true },
		{ id: "d", on: spy("on d", 1), quiet: true },
		{ id: "e", on: spy("on e", true), when: spy("when e", "yes"), quiet: true },
	];
	const { table } = composeBindingTable({ guards: GUARDS.slice(0, 1), tenants: [{ owner: "t", rows: rows.slice(0, 2) }, { owner: "u", rows: rows.slice(2) }] });
	const fact = { fact: true }, context = { context: true };
	for (const call of [() => table.traceInput(fact, context, { busy: true }), () => table.matchInput(fact, context, { busy: true }), () => table.findOverlaps([fact], [context], [{ busy: true }])]) {
		calls.length = 0;
		call();
		assert.deepEqual(calls.map((c) => c.name), ["on a", "on c", "on d", "on e", "when a", "when e"], "row b is refused; c is unbound; d has no when");
		for (const c of calls) {
			assert.equal(c.self, undefined, `${c.name} is called with no receiver: a strict predicate sees this undefined`);
			assert.equal(c.args.length, 1, `${c.name} is called with one argument`);
			assert.equal(c.args[0], c.name.startsWith("on") ? fact : context, "the fact and the context, by reference");
		}
	}
});

test("I6: a sloppy predicate sees the global object, a bound one its own, an arrow its own", () => {
	const seen = {};
	// a function made by Function is sloppy, as no function written in a module can be
	const sloppyOn = new Function("seen", "return function () { seen.sloppy = this; return true; }")(seen);
	const mine = { mine: true };
	const bound = function () {
		seen.bound = this;
		return true;
	}.bind(mine);
	const arrow = function () {
		return () => {
			seen.arrow = this;
			return true;
		};
	}.call(mine);
	const { table } = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "s", on: sloppyOn }, { id: "b", on: bound }, { id: "a", on: arrow }] }] });
	table.traceInput(null, null);
	assert.equal(seen.sloppy, globalThis);
	assert.equal(seen.bound, mine);
	assert.equal(seen.arrow, mine);
});

test("I6: a throwing predicate's exception propagates unchanged, and the table answers the next call as before", () => {
	const thrown = new RangeError("the predicate's own");
	let fail = true;
	const calls = [];
	const rows = [
		{ id: "a", on: () => (calls.push("a"), true) },
		{ id: "b", on: () => {
			calls.push("b");
			if (fail) throw thrown;
			return false;
		} },
		{ id: "c", on: () => (calls.push("c"), true), when: () => (calls.push("when c"), true) },
	];
	const { table } = composeBindingTable({ tenants: [{ owner: "a", rows }] });
	for (const call of [() => table.traceInput(1, 2), () => table.matchInput(1, 2), () => table.findOverlaps([1], [2], [{}])]) {
		calls.length = 0;
		assert.throws(call, (e) => e === thrown);
		assert.deepEqual(calls, ["a", "b"], "nothing after the throw is called");
	}
	const thrownWhen = { not: "an Error" };
	const throwsWhen = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "x", on: () => true, when: () => {
		throw thrownWhen;
	} }] }] }).table;
	assert.throws(() => throwsWhen.matchInput(null, null), (e) => e === thrownWhen, "a value thrown that is no Error propagates too");
	fail = false;
	assert.deepEqual(table.traceInput(1, 2).map((t) => t.hit), [true, false, true]);
	assert.equal(table.matchInput(1, 2).match, null, "two hits: none");
});
