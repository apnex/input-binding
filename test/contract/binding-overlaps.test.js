// binding-overlaps - IB8 (I7): every combination, among the facts, contexts and guard states given, in which
// two or more rows hit -- guard states outermost, facts innermost -- with ids in table order; all three
// arrays read and checked before any predicate is called.
import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBindingTable } from "@apnex/input-binding";
import { randomTools, seededRandom } from "../support/doubles.js";
import { isFrozenToDepth } from "../support/frozen.js";
import { recorded } from "../support/recording-proxy.js";

const GUARD = { state: "busy", flag: "quiet", default: false, refuses: "state-without-flag" };
const refuses = (call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith("findOverlaps:"), `findOverlaps refuses ${label}`);

/** Rows a (facts 1, 2), b (facts 2, 3, quiet), c (fact 2 in context "x"), d (fact 3). */
const ROWS = [
	{ id: "a", on: (f) => f === 1 || f === 2 },
	{ id: "b", on: (f) => f === 2 || f === 3, quiet: true },
	{ id: "c", on: (f) => f === 2, when: (c) => c === "x" },
	{ id: "d", on: (f) => f === 3 },
];
const table = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "t", rows: ROWS.slice(0, 2) }, { owner: "u", rows: ROWS.slice(2) }] }).table;

test("IB8: an empty answer, when no combination holds two hits, and when a list is empty", () => {
	assert.deepEqual(table.findOverlaps([1, 4], ["x", "y"], [{}, { busy: true }]), []);
	assert.deepEqual(table.findOverlaps([], ["x"], [{}]), []);
	assert.deepEqual(table.findOverlaps([2], [], [{}]), []);
	assert.deepEqual(table.findOverlaps([2], ["x"], []), []);
	assert.ok(Object.isFrozen(table.findOverlaps([], [], [])));
});

test("IB8: guard states outermost, then contexts, then facts; ids in table order; the values given, by reference", () => {
	const facts = [3, 2, { not: "matched" }];
	const contexts = ["y", "x"];
	const free = {}, busy = { busy: true };
	const found = table.findOverlaps(facts, contexts, [free, busy]);
	assert.deepEqual(found.map((o) => [o.guards === free ? "free" : "busy", o.context, o.fact, o.ids]), [
		["free", "y", 3, ["b", "d"]],
		["free", "y", 2, ["a", "b"]],
		["free", "x", 3, ["b", "d"]],
		["free", "x", 2, ["a", "b", "c"]],
	]);
	const quiet = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "t", rows: ROWS.map((r) => ({ ...r, quiet: true })) }] }).table;
	assert.deepEqual(quiet.findOverlaps(facts, contexts, [free, busy]).map((o) => [o.guards === free ? "free" : "busy", o.context, o.fact]), [
		["free", "y", 3],
		["free", "y", 2],
		["free", "x", 3],
		["free", "x", 2],
		["busy", "y", 3],
		["busy", "y", 2],
		["busy", "x", 3],
		["busy", "x", 2],
	], "under busy only b is admitted in the first table; with every row quiet the order repeats for each guard state");
	for (const o of found) {
		assert.deepEqual(Object.keys(o), ["fact", "context", "guards", "ids"]);
		assert.ok(facts.includes(o.fact) && contexts.includes(o.context));
	}
	assert.ok(isFrozenToDepth(found, new Set([free, busy])));
	assert.ok(!Object.isFrozen(free) && !Object.isFrozen(busy) && !Object.isFrozen(facts), "no argument frozen");
});

test("IB8: an overlap under one guard state alone", () => {
	const t = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "t", rows: [{ id: "x", on: () => true }, { id: "y", on: () => true, quiet: true }] }] }).table;
	const free = {};
	const found = t.findOverlaps([0], [0], [{ busy: true }, free]);
	assert.equal(found.length, 1);
	assert.equal(found[0].guards, free);
	assert.deepEqual(found[0].ids, ["x", "y"]);
});

test("IB8: undefined accepted as a fact and as a context, refused as a guard state; holes and arrays of another form refused", () => {
	const t = composeBindingTable({ tenants: [{ owner: "t", rows: [{ id: "x", on: (f) => f === undefined, when: (c) => c === undefined }, { id: "y", on: (f) => f === undefined }] }] }).table;
	const found = t.findOverlaps([undefined], [undefined], [{}]);
	assert.equal(found.length, 1);
	assert.ok("fact" in found[0] && found[0].fact === undefined && found[0].context === undefined);
	refuses(() => t.findOverlaps([undefined], [undefined], [undefined]), "an undefined guard state");
	refuses(() => t.findOverlaps([undefined], [undefined], [null]), "a null guard state");
	class Subarray extends Array {}
	const bad = [undefined, null, 5, "ab", {}, new Array(1), Object.assign([1], { extra: 1 }), Subarray.from([1]), Object.defineProperty([1], 1, { get: () => assert.fail("an element getter ran"), enumerable: true }), { length: 0 }];
	for (const [k, list] of bad.entries()) {
		refuses(() => t.findOverlaps(list, [], []), `facts, bad case ${k}`);
		refuses(() => t.findOverlaps([], list, []), `contexts, bad case ${k}`);
		refuses(() => t.findOverlaps([], [], list), `guardStates, bad case ${k}`);
	}
});

test("I7: a malformed guard state is refused before any predicate is called, even with no facts", () => {
	const calls = [];
	const t = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "t", rows: [{ id: "x", on: () => (calls.push("on"), true) }] }] }).table;
	refuses(() => t.findOverlaps([], ["c"], [{ busy: true }, { busy: "yes" }]), "a non-boolean state");
	refuses(() => t.findOverlaps([1, 2], ["c"], [{}, { other: true }]), "an undeclared state");
	refuses(() => t.findOverlaps([1, 2], ["c"], [{}, 5]), "a guard state of another kind");
	refuses(() => t.findOverlaps([1], ["c"], [{}, Object.defineProperty({}, "busy", { get: () => true, enumerable: true })]), "an accessor state");
	assert.deepEqual(calls, []);
});

test("IB2: findOverlaps reads facts, then contexts, then guardStates -- each array whole -- then each guard state, and never a fact or a context", () => {
	const log = [];
	const fact = recorded({}, "fact", log), context = recorded({}, "context", log);
	const g0 = recorded({ busy: false }, "g0", log), g1 = recorded({}, "g1", log);
	table.findOverlaps(recorded([fact], "facts", log), recorded([context], "contexts", log), recorded([g0, g1], "guardStates", log));
	const array = (label, n) => [`${label} getPrototypeOf`, `${label} ownKeys`, `${label} getOwnPropertyDescriptor length`, ...Array.from({ length: n }, (_, i) => `${label} getOwnPropertyDescriptor ${i}`)];
	assert.deepEqual(log, [...array("facts", 1), ...array("contexts", 1), ...array("guardStates", 2), "g0 getPrototypeOf", "g0 ownKeys", "g0 getOwnPropertyDescriptor busy", "g1 getPrototypeOf", "g1 ownKeys"]);
	const stopped = [];
	refuses(() => table.findOverlaps(recorded([1], "facts", stopped), recorded(Object.assign([], { x: 1 }), "contexts", stopped), recorded([], "guardStates", stopped)), "contexts with an extra property");
	assert.deepEqual(stopped, [...array("facts", 1), "contexts getPrototypeOf", "contexts ownKeys"], "the reading stops at the first malformed argument");
});

test("I7: over generated tables, exactly the combinations in which two or more rows hit, in IB8's order", () => {
	const rnd = seededRandom();
	const { int, chance } = randomTools(rnd);
	let total = 0;
	for (let n = 0; n < 80; n++) {
		const rows = Array.from({ length: int(1, 6) }, (_, i) => {
			const facts = new Set([int(0, 3), int(0, 3)]);
			const contexts = new Set([int(0, 2)]);
			const r = { id: `r${i}`, on: (f) => facts.has(f) };
			if (chance(0.5)) r.when = (c) => contexts.has(c);
			if (chance(0.5)) r.quiet = chance(0.5);
			return r;
		});
		const t = composeBindingTable({ guards: [GUARD], tenants: [{ owner: "t", rows }] }).table;
		const facts = [0, 1, 2, 3], contexts = [0, 1, 2], states = [{}, { busy: true }, { busy: false }];
		const expected = [];
		for (const g of states) for (const c of contexts) for (const f of facts) {
			const ids = t.traceInput(f, c, g).filter((r) => r.hit).map((r) => r.id);
			if (ids.length >= 2) expected.push({ fact: f, context: c, guards: g, ids });
		}
		const found = t.findOverlaps(facts, contexts, states);
		assert.deepEqual(found, expected);
		assert.ok(found.every((o, i) => o.guards === expected[i].guards));
		total += found.length;
	}
	assert.ok(total > 200, `${total} overlaps found`);
});
