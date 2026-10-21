// one-binding-match - IB5 and IB7 (I3, I4, I5): guards admit a row exactly when none refuses it; the one
// row an input means, or none when none or several do, never chosen by position; and whether the input
// is claimed.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { composeBindingTable } from "@apnex/input-binding";
import { randomTools, seededRandom } from "../support/doubles.js";
import { phantom, recorded } from "../support/recording-proxy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FORMS = ["state-and-flag", "state-without-flag", "flag-without-state"];
const refusedBy = { "state-and-flag": (s, f) => s && f, "state-without-flag": (s, f) => s && !f, "flag-without-state": (s, f) => f && !s };
const on = () => true;
const refuses = (fn, call, label) => assert.throws(call, (e) => e instanceof TypeError && e.message.startsWith(`${fn}:`), `${fn} refuses ${label}`);

test("IB5: each refusal form at each of its four combinations of state and flag", () => {
	for (const form of FORMS) {
		for (const s of [false, true]) {
			for (const f of [false, true]) {
				const { table } = composeBindingTable({ guards: [{ state: "s", flag: "f", default: false, refuses: form }], tenants: [{ owner: "a", rows: [{ id: "x", on, f }] }] });
				const admitted = table.matchInput(null, null, { s }).match !== null;
				assert.equal(admitted, !refusedBy[form](s, f), `${form}, s ${s}, f ${f}`);
				assert.equal(table.traceInput(null, null, { s })[0].refusedBy, refusedBy[form](s, f) ? "f" : null);
			}
		}
	}
});

test("I3: for every guard form, state and flag, over two guards, a row is admitted exactly when no guard refuses it", () => {
	for (const formA of FORMS) for (const formB of FORMS) for (const sameState of [false, true]) {
		const guards = [
			{ state: "a", flag: "fa", default: false, refuses: formA },
			{ state: sameState ? "a" : "b", flag: "fb", default: true, refuses: formB },
		];
		for (const sa of [false, true]) for (const sb of [false, true]) for (const fa of [false, true, undefined]) for (const fb of [false, true, undefined]) {
			const r = { id: "x", on };
			if (fa !== undefined) r.fa = fa;
			if (fb !== undefined) r.fb = fb;
			const { table } = composeBindingTable({ guards, tenants: [{ owner: "o", rows: [r] }] });
			const state = sameState ? { a: sa } : { a: sa, b: sb };
			const fA = fa ?? false, fB = fb ?? true, sB = sameState ? sa : sb;
			const expected = refusedBy[formA](sa, fA) ? "fa" : refusedBy[formB](sB, fB) ? "fb" : null;
			assert.equal(table.traceInput(null, null, state)[0].refusedBy, expected, JSON.stringify({ guards, state, r: { fa, fb } }));
			assert.equal(table.matchInput(null, null, state).match !== null, expected === null);
		}
	}
});

test("I3: four guards of the first consumer's, over all 128 combinations of their four flags and three states, admit exactly what its rule admits", () => {
	const corpus = JSON.parse(fs.readFileSync(path.join(here, "..", "corpus", "i13-corpus.json"), "utf8"));
	const explicit = corpus.admission.filter((a) => a.states !== null && Object.keys(a.flags).length === 4 && Object.keys(a.states).length === 3);
	assert.equal(explicit.length, 128);
	for (const { flags, states, admitted } of explicit) {
		const { table } = composeBindingTable({ guards: corpus.guards, tenants: [{ owner: "o", rows: [{ id: "x", on, ...flags }] }] });
		assert.equal(table.matchInput(null, null, states).match !== null, admitted, JSON.stringify({ flags, states }));
	}
});

test("IB5: an omitted guard state is all states false; a state a guard state omits is false", () => {
	const { table } = composeBindingTable({ guards: [{ state: "s", flag: "f", default: false, refuses: "flag-without-state" }], tenants: [{ owner: "a", rows: [{ id: "x", on, f: true }] }] });
	assert.equal(table.matchInput(null, null).match, null, "f and not s: refused");
	assert.equal(table.matchInput(null, null, undefined).match, null);
	assert.equal(table.matchInput(null, null, {}).match, null);
	assert.equal(table.matchInput(null, null, { s: true }).match.id, "x");
});

test("IB5: an undeclared state, a non-boolean value, an accessor and a value of another form are refused with the function's name", () => {
	const { table } = composeBindingTable({ guards: [{ state: "s", flag: "f", default: false, refuses: "state-without-flag" }], tenants: [{ owner: "a", rows: [{ id: "x", on }] }] });
	const bad = [null, 5, "s", [], () => ({}), Object.create({}), { t: true }, { s: 1 }, { s: "true" }, { s: undefined }, { s: null }, Object.defineProperty({}, "s", { get: () => true, enumerable: true })];
	for (const guards of bad) {
		refuses("matchInput", () => table.matchInput(null, null, guards), JSON.stringify(guards));
		refuses("traceInput", () => table.traceInput(null, null, guards), JSON.stringify(guards));
	}
	const empty = composeBindingTable({ tenants: [] }).table;
	refuses("matchInput", () => empty.matchInput(null, null, { s: false }), "a state where no guard is declared");
	assert.deepEqual(empty.matchInput(null, null, {}), { match: null, claimed: false });
	assert.equal(table.matchInput(null, null, Object.assign(Object.create(null), { s: false })).match.id, "x", "a null prototype is plain");
	assert.equal(table.matchInput(null, null, { [Symbol("x")]: 1 }).match.id, "x", "a symbol-named property is ignored");
});

test("IB2: matchInput and traceInput read the guard state -- its prototype, its own keys, each own string-named property's descriptor in order -- and never the fact or the context", () => {
	const { table } = composeBindingTable({ guards: [{ state: "s", flag: "f", default: false, refuses: "state-without-flag" }, { state: "t", flag: "g", default: false, refuses: "state-without-flag" }], tenants: [{ owner: "a", rows: [{ id: "x", on: () => true, when: () => true }] }] });
	for (const fn of ["matchInput", "traceInput"]) {
		const log = [];
		const fact = recorded({}, "fact", log);
		const context = recorded({}, "context", log);
		table[fn](fact, context, recorded({ t: false, s: false }, "guards", log));
		assert.deepEqual(log, ["guards getPrototypeOf", "guards ownKeys", "guards getOwnPropertyDescriptor t", "guards getOwnPropertyDescriptor s"], fn);
		const stopped = [];
		refuses(fn, () => table[fn](null, null, recorded({ s: false, z: true, t: 1 }, "guards", stopped)), "an undeclared state");
		assert.deepEqual(stopped, ["guards getPrototypeOf", "guards ownKeys", "guards getOwnPropertyDescriptor s", "guards getOwnPropertyDescriptor z"], "an undeclared state is refused at its own descriptor, each key judged as it is read");
		const atValue = [];
		refuses(fn, () => table[fn](null, null, recorded({ s: 1, t: false }, "guards", atValue)), "a non-boolean");
		assert.deepEqual(atValue, ["guards getPrototypeOf", "guards ownKeys", "guards getOwnPropertyDescriptor s"], "a non-boolean stops the reading at its descriptor");
	}
});

test("IB2 and IB5: a phantom key of a guard state -- listed by its own keys, its descriptor undefined -- is absent, declared or not, and judged only after its descriptor is read", () => {
	const { table } = composeBindingTable({ guards: [{ state: "s", flag: "f", default: false, refuses: "state-without-flag" }], tenants: [{ owner: "a", rows: [{ id: "x", on }] }] });
	assert.equal(table.matchInput(null, null, phantom({}, "undeclared")).match.id, "x", "a phantom undeclared name names no state");
	assert.equal(table.matchInput(null, null, phantom({}, "s")).match.id, "x", "a phantom declared name is absent, so its state is false");
	assert.equal(table.matchInput(null, null, phantom({ s: true }, "undeclared")).match, null, "the present state still counts");
	assert.equal(table.traceInput(null, null, phantom({}, "undeclared", "s"))[0].refusedBy, null);
	refuses("matchInput", () => table.matchInput(null, null, phantom({ undeclared: false }, "s")), "a present undeclared name beside a phantom one");
	const log = [];
	table.matchInput(null, null, recorded(phantom({ s: false }, "undeclared"), "guards", log));
	assert.deepEqual(log, ["guards getPrototypeOf", "guards ownKeys", "guards getOwnPropertyDescriptor s", "guards getOwnPropertyDescriptor undeclared"], "every key's descriptor is read, as IB2's table says");
	assert.deepEqual(table.findOverlaps([0], [0], [phantom({}, "undeclared")]), []);
});

test("IB7: claimed with a hit, with an unmet when, with two hits, refused by a guard, unbound, and with no claim declared", () => {
	const declaration = (rows, claim = { flag: "c", default: true }) => ({ guards: [{ state: "s", flag: "f", default: false, refuses: "state-without-flag" }], claim, tenants: [{ owner: "a", rows }] });
	const hit = { id: "hit", on: () => true };
	const unmet = { id: "unmet", on: () => true, when: () => false };
	const unclaiming = { id: "quiet", on: () => true, c: false };
	const unbound = { id: "unbound", on: () => false };
	const answer = (rows, guards, claim) => composeBindingTable(declaration(rows, claim)).table.matchInput(null, null, guards);
	assert.deepEqual(answer([hit]), { match: answer([hit]).match, claimed: true });
	assert.equal(answer([hit]).match.id, "hit");
	assert.deepEqual(answer([unmet]), { match: null, claimed: true }, "claimed whatever its when answered");
	assert.deepEqual(answer([hit, { ...hit, id: "hit2" }]), { match: null, claimed: true }, "two hits mean nothing, and the input is still claimed");
	assert.equal(answer([unclaiming, unmet]).match.id, "quiet", "one hit beside an unmet row is the match");
	assert.equal(answer([unclaiming, unmet]).claimed, true, "the unmet row claims");
	assert.equal(answer([unclaiming]).claimed, false, "a bound row whose claim flag is false");
	assert.equal(answer([unclaiming]).match.id, "quiet");
	assert.deepEqual(answer([unbound]), { match: null, claimed: false });
	assert.deepEqual(answer([hit], { s: true }), { match: null, claimed: false }, "a refused row claims nothing");
	assert.deepEqual(answer([hit, unmet], undefined, undefined), answer([hit, unmet], undefined, undefined));
	const noClaim = composeBindingTable({ tenants: [{ owner: "a", rows: [hit, { ...unmet, c: true }] }] }).table;
	assert.deepEqual(noClaim.matchInput(null, null).claimed, false, "always false with no claim declared");
	assert.equal(composeBindingTable(declaration([{ ...hit, c: false }], { flag: "c", default: false })).table.matchInput(null, null).claimed, false);
	assert.equal(composeBindingTable(declaration([hit], { flag: "c", default: false })).table.matchInput(null, null).claimed, false, "the declared default is the omitted flag's");
	assert.deepEqual(Object.keys(answer([hit])), ["match", "claimed"]);
});

test("IB7: the match is the row's entry in table.rows", () => {
	const r = { id: "x", on: () => true, payload: {} };
	const { table } = composeBindingTable({ opens: { field: "opens" }, tenants: [{ owner: "a", rows: [{ id: "y", on: () => false }, { ...r, opens: "drag" }] }] });
	const { match } = table.matchInput(null, null);
	assert.equal(match, table.rows[1]);
	assert.deepEqual(Object.keys(match), ["id", "owner", "opens", "row"]);
	assert.equal(match.opens, "drag");
});

/** A generated table: its rows' predicates hold of chosen facts and contexts, each row's flags drawn at random. */
function generatedTable(rnd) {
	const { int, pick, chance } = randomTools(rnd);
	const guards = [
		{ state: "s0", flag: "f0", default: chance(0.5), refuses: pick(FORMS) },
		{ state: "s1", flag: "f1", default: chance(0.5), refuses: pick(FORMS) },
		{ state: pick(["s0", "s1"]), flag: "f2", default: chance(0.5), refuses: pick(FORMS) },
	];
	const claim = chance(0.8) ? { flag: "c", default: chance(0.5) } : undefined;
	const rows = [];
	for (let i = int(1, 7); i > 0; i--) {
		const facts = new Set(Array.from({ length: int(0, 3) }, () => int(0, 3)));
		const contexts = new Set(Array.from({ length: int(0, 3) }, () => int(0, 2)));
		const r = { id: `r${rows.length}`, on: (fact) => facts.has(fact) };
		if (chance(0.6)) r.when = (context) => (contexts.has(context) ? pick([1, "y", {}, true]) : pick([0, "", null, false, undefined]));
		if (chance(0.5)) r.f0 = chance(0.5);
		if (chance(0.5)) r.f1 = chance(0.5);
		if (chance(0.5)) r.f2 = chance(0.5);
		if (claim && chance(0.5)) r.c = chance(0.5);
		rows.push(r);
	}
	const tenants = [];
	for (const r of rows) {
		if (tenants.length === 0 || chance(0.4)) tenants.push({ owner: `t${tenants.length}`, rows: [] });
		tenants[tenants.length - 1].rows.push(r);
	}
	return { declaration: { guards, ...(claim ? { claim } : {}), tenants }, rows };
}

const GUARD_STATES = [undefined, {}, { s0: true }, { s1: true }, { s0: true, s1: true }, { s0: false, s1: true }];

test("I4: over generated tables, facts, contexts and guard states, the match is the one hit of the trace, or null; claimed is as IB7 states", () => {
	const rnd = seededRandom();
	let ones = 0, nones = 0, several = 0;
	for (let n = 0; n < 150; n++) {
		const { declaration } = generatedTable(rnd);
		const composed = composeBindingTable(declaration);
		assert.equal(composed.ok, true);
		const { table } = composed;
		const flagOf = (entry, name, fallback) => (Object.hasOwn(entry.row, name) ? entry.row[name] : fallback);
		for (const guards of GUARD_STATES) for (const fact of [0, 1, 2, 3, 4]) for (const context of [0, 1, 2]) {
			const trace = table.traceInput(fact, context, guards);
			const { match, claimed } = table.matchInput(fact, context, guards);
			const hits = trace.filter((t) => t.hit);
			if (hits.length === 1) {
				ones++;
				assert.equal(match.id, hits[0].id);
				assert.equal(match, table.rows.find((e) => e.id === hits[0].id));
			} else {
				hits.length === 0 ? nones++ : several++;
				assert.equal(match, null);
			}
			const expectClaimed = declaration.claim !== undefined && trace.some((t, i) => t.on === true && flagOf(table.rows[i], "c", declaration.claim.default));
			assert.equal(claimed, expectClaimed);
		}
	}
	assert.ok(ones > 500 && nones > 500 && several > 100, `answers of every kind: ${ones} one, ${nones} none, ${several} several`);
});

test("I5: order decides nothing -- every permutation of tenants and of rows leaves every match's id and claimed unchanged", () => {
	const rnd = seededRandom();
	const { shuffle, int } = randomTools(rnd);
	for (let n = 0; n < 60; n++) {
		const { declaration, rows } = generatedTable(rnd);
		const base = composeBindingTable(declaration).table;
		const answers = (table) => GUARD_STATES.flatMap((g) => [0, 1, 2, 3, 4].flatMap((f) => [0, 1, 2].map((c) => {
			const a = table.matchInput(f, c, g);
			return [a.match?.id ?? null, a.claimed];
		})));
		const expected = answers(base);
		for (let k = 0; k < 12; k++) {
			const order = shuffle(rows);
			const tenants = [];
			for (const r of order) {
				if (tenants.length === 0 || int(0, 2) === 0) tenants.push({ owner: `p${tenants.length}`, rows: [] });
				tenants[tenants.length - 1].rows.push(r);
			}
			const permuted = composeBindingTable({ ...declaration, tenants: shuffle(tenants) }).table;
			assert.deepEqual(answers(permuted), expected);
		}
	}
});
