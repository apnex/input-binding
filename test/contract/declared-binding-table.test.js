// declared-binding-table - IB2, IB3 and IB4 (I1, I2): a declaration composed into a table, or refused with
// every problem it has, each at its pointer, in one order; the reading order of a declaration, held by
// Proxies that record each trap; and what a table holds.
import assert from "node:assert/strict";
import { test } from "node:test";

import { composeBindingTable } from "@apnex/input-binding";
import { isFrozenToDepth } from "../support/frozen.js";
import { phantom, recorded, revoked, trapping } from "../support/recording-proxy.js";

const on = () => true;
const row = (id, extra = {}) => ({ id, on, ...extra });
const one = (...rows) => [{ owner: "a", rows }];
const p = (pointer, problem) => ({ pointer, problem });
const GUARD = { state: "busy", flag: "quiet", default: false, refuses: "state-without-flag" };
const accessor = (target, name, get = () => assert.fail(`the getter of ${name} ran`)) => Object.defineProperty(target, name, { get, enumerable: true, configurable: true });
const sparse = (n) => new Array(n);
const withExtra = (list) => Object.assign([...list], { extra: 1 });
class Subarray extends Array {}
const label = (v) => {
	try {
		return String(v);
	} catch {
		return "a value String cannot show";
	}
};

/** The problems a declaration is refused with; fails when it composes. */
function problemsOf(declaration) {
	const result = composeBindingTable(declaration);
	assert.equal(result.ok, false, "the declaration is refused");
	return result.problems.map((x) => ({ pointer: x.pointer, problem: x.problem }));
}

const NOT_AN_OBJECT = [undefined, null, 0, 5, "tenants", true, 1n, Symbol("d"), [], () => ({}), new Date(0), Object.create({ tenants: [] }), new (class Declaration {})(), revoked({ tenants: [] }), trapping({ tenants: [] }, "getPrototypeOf"), trapping({ tenants: [] }, "ownKeys"), trapping({ tenants: [] }, "getOwnPropertyDescriptor")];

test("I1: composeBindingTable never throws, for any value, and refuses a value that is not a plain object at \"\" alone", () => {
	for (const value of NOT_AN_OBJECT) assert.deepEqual(problemsOf(value), [p("", "not-an-object")], String(typeof value));
	assert.deepEqual(problemsOf(), [p("", "not-an-object")], "no argument at all");
	const weird = [{ tenants: revoked([]) }, { tenants: [revoked({})] }, { guards: [trapping({}, "ownKeys")], tenants: [] }, { tenants: [{ owner: "a", rows: [trapping({ id: "x", on }, "getOwnPropertyDescriptor")] }] }, { claim: revoked({}), opens: trapping({}, "getPrototypeOf"), tenants: [] }];
	for (const value of weird) assert.doesNotThrow(() => composeBindingTable(value));
});

test("IB2: a plain object of a null prototype is plain, and a symbol-named property is ignored", () => {
	const declaration = Object.assign(Object.create(null), { tenants: one(row("x")), [Symbol("s")]: 1 });
	assert.equal(composeBindingTable(declaration).ok, true);
	assert.equal(composeBindingTable({ tenants: [Object.assign(Object.create(null), { owner: "a", rows: [Object.assign(Object.create(null), { id: "x", on })] })] }).ok, true);
});

test("IB3 step 2: an unknown property each, escaped; tenants absent; present undefined is of no form", () => {
	assert.deepEqual(problemsOf({}), [p("/tenants", "missing-property")]);
	assert.deepEqual(problemsOf({ tenants: [], extra: 1, "a/b": 2, "c~d": 3, "": 4 }), [p("/", "unknown-property"), p("/a~1b", "unknown-property"), p("/c~0d", "unknown-property"), p("/extra", "unknown-property")]);
	assert.deepEqual(problemsOf({ tenants: undefined }), [p("/tenants", "invalid-value")]);
	assert.deepEqual(problemsOf(accessor({}, "tenants")), [p("/tenants", "invalid-value")], "an accessor is present and of no form, its getter never called");
});

test("IB2: an inherited property is absent", () => {
	Object.prototype.tenants = one(row("x"));
	try {
		assert.deepEqual(problemsOf({}), [p("/tenants", "missing-property")]);
	} finally {
		delete Object.prototype.tenants;
	}
});

test("IB3 step 3: guards and each guard's four members", () => {
	for (const guards of [5, {}, undefined, null, "g", sparse(1), withExtra([GUARD]), Subarray.from([GUARD]), Object.create(Array.prototype), revoked([]), accessor([GUARD], 1, () => GUARD)]) {
		assert.deepEqual(problemsOf({ guards, tenants: [] }), [p("/guards", "invalid-value")], label(guards));
	}
	assert.deepEqual(problemsOf(accessor({ tenants: [] }, "guards")), [p("/guards", "invalid-value")]);
	assert.deepEqual(problemsOf({ guards: [5, null, [], revoked({})], tenants: [] }), [p("/guards/0", "not-an-object"), p("/guards/1", "not-an-object"), p("/guards/2", "not-an-object"), p("/guards/3", "not-an-object")]);
	assert.deepEqual(problemsOf({ guards: [{}], tenants: [] }), ["default", "flag", "refuses", "state"].map((n) => p(`/guards/0/${n}`, "missing-property")));
	assert.deepEqual(problemsOf({ guards: [{ ...GUARD, extra: 1, "x/y": 2 }], tenants: [] }), [p("/guards/0/extra", "unknown-property"), p("/guards/0/x~1y", "unknown-property")]);
	const bad = [
		["state", ""],
		["state", 5],
		["state", undefined],
		["flag", ""],
		["flag", "id"],
		["flag", "on"],
		["flag", "when"],
		["flag", null],
		["default", "false"],
		["default", 0],
		["default", undefined],
		["refuses", "both"],
		["refuses", ""],
		["refuses", undefined],
	];
	for (const [name, value] of bad) assert.deepEqual(problemsOf({ guards: [{ ...GUARD, [name]: value }], tenants: [] }), [p(`/guards/0/${name}`, "invalid-value")], `${name}: ${label(value)}`);
	for (const name of ["state", "flag", "default", "refuses"]) {
		const guard = { ...GUARD };
		delete guard[name];
		assert.deepEqual(problemsOf({ guards: [accessor(guard, name)], tenants: [] }), [p(`/guards/0/${name}`, "invalid-value")], `an accessor ${name}`);
	}
	assert.equal(composeBindingTable({ guards: [GUARD, { ...GUARD, flag: "loud", refuses: "state-and-flag" }, { ...GUARD, flag: "f", refuses: "flag-without-state" }], tenants: [] }).ok, true, "several guards may name one state");
});

test("IB3 step 4: claim and its two members", () => {
	for (const claim of [5, null, undefined, [], "c", revoked({}), Object.create({ flag: "c", default: true })]) assert.deepEqual(problemsOf({ claim, tenants: [] }), [p("/claim", "not-an-object")], label(claim));
	assert.deepEqual(problemsOf(accessor({ tenants: [] }, "claim")), [p("/claim", "not-an-object")]);
	assert.deepEqual(problemsOf({ claim: {}, tenants: [] }), [p("/claim/default", "missing-property"), p("/claim/flag", "missing-property")]);
	assert.deepEqual(problemsOf({ claim: { flag: "c", default: true, extra: 1 }, tenants: [] }), [p("/claim/extra", "unknown-property")]);
	for (const flag of ["", "id", "on", "when", 3, undefined]) assert.deepEqual(problemsOf({ claim: { flag, default: true }, tenants: [] }), [p("/claim/flag", "invalid-value")], label(flag));
	for (const value of ["true", 1, null, undefined]) assert.deepEqual(problemsOf({ claim: { flag: "c", default: value }, tenants: [] }), [p("/claim/default", "invalid-value")], label(value));
});

test("IB3 step 5: opens and its field", () => {
	for (const opens of [5, null, undefined, ["field"], revoked({})]) assert.deepEqual(problemsOf({ opens, tenants: [] }), [p("/opens", "not-an-object")], label(opens));
	assert.deepEqual(problemsOf({ opens: {}, tenants: [] }), [p("/opens/field", "missing-property")]);
	assert.deepEqual(problemsOf({ opens: { field: "g", other: 1 }, tenants: [] }), [p("/opens/other", "unknown-property")]);
	for (const field of ["", "id", "on", "when", 1, undefined]) assert.deepEqual(problemsOf({ opens: { field }, tenants: [] }), [p("/opens/field", "invalid-value")], label(field));
	assert.deepEqual(problemsOf({ opens: accessor({}, "field"), tenants: [] }), [p("/opens/field", "invalid-value")]);
});

test("IB3 step 6: a row-property name equal to an earlier one, each judged at its own pointer whatever its siblings", () => {
	assert.deepEqual(problemsOf({ guards: [GUARD, { ...GUARD }], tenants: [] }), [p("/guards/1/flag", "duplicate-field")]);
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "quiet", default: true }, tenants: [] }), [p("/claim/flag", "duplicate-field")]);
	assert.deepEqual(problemsOf({ claim: { flag: "g", default: true }, opens: { field: "g" }, tenants: [] }), [p("/opens/field", "duplicate-field")]);
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "quiet", default: true }, opens: { field: "quiet" }, tenants: [] }), [p("/claim/flag", "duplicate-field"), p("/opens/field", "duplicate-field")]);
	// a guard whose state is invalid, or which holds an unknown property, still gives its flag
	assert.deepEqual(problemsOf({ guards: [GUARD, { ...GUARD, state: "", extra: 1 }], tenants: [] }), [p("/guards/1/extra", "unknown-property"), p("/guards/1/flag", "duplicate-field"), p("/guards/1/state", "invalid-value")]);
	// a flag invalid at its own pointer gives no name, so a later equal name is no duplicate of it
	assert.deepEqual(problemsOf({ guards: [{ ...GUARD, flag: "id" }, { ...GUARD, flag: "x" }], claim: { flag: "x", default: false }, tenants: [] }), [p("/claim/flag", "duplicate-field"), p("/guards/0/flag", "invalid-value")]);
	// a missing claim member does not stop its flag being judged
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "quiet" }, tenants: [] }), [p("/claim/default", "missing-property"), p("/claim/flag", "duplicate-field")]);
});

test("IB3 step 7: tenants, each tenant's owner and rows; two tenants may share an owner", () => {
	for (const tenants of [5, {}, null, "t", sparse(2), withExtra([]), Subarray.from([]), revoked([])]) assert.deepEqual(problemsOf({ tenants }), [p("/tenants", "invalid-value")], label(tenants));
	assert.deepEqual(problemsOf({ tenants: [5, null, revoked({})] }), [p("/tenants/0", "not-an-object"), p("/tenants/1", "not-an-object"), p("/tenants/2", "not-an-object")]);
	assert.deepEqual(problemsOf({ tenants: [{}] }), [p("/tenants/0/owner", "missing-property"), p("/tenants/0/rows", "missing-property")]);
	assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows: [], x: 1 }] }), [p("/tenants/0/x", "unknown-property")]);
	for (const owner of ["", 5, null, undefined]) assert.deepEqual(problemsOf({ tenants: [{ owner, rows: [] }] }), [p("/tenants/0/owner", "invalid-value")], label(owner));
	for (const rows of [5, {}, undefined, sparse(1), withExtra([row("x")]), Subarray.from([row("x")]), accessor([row("x")], 1, () => row("y"))]) assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows }] }), [p("/tenants/0/rows", "invalid-value")], label(rows));
	const shared = composeBindingTable({ tenants: [{ owner: "a", rows: [row("x")] }, { owner: "a", rows: [row("y")] }] });
	assert.equal(shared.ok, true);
	assert.deepEqual(shared.table.rows.map((e) => [e.id, e.owner]), [["x", "a"], ["y", "a"]]);
});

test("IB3 step 8: a row, its id, on and when; its payload never inspected", () => {
	assert.deepEqual(problemsOf({ tenants: one(5, null, [], revoked({}), trapping({ id: "x", on }, "ownKeys")) }), [0, 1, 2, 3, 4].map((j) => p(`/tenants/0/rows/${j}`, "not-an-object")));
	assert.deepEqual(problemsOf({ tenants: one({}) }), [p("/tenants/0/rows/0/id", "missing-property"), p("/tenants/0/rows/0/on", "missing-property")]);
	for (const [name, value] of [["id", ""], ["id", 5], ["id", undefined], ["on", "f"], ["on", {}], ["on", undefined], ["when", 5], ["when", undefined], ["when", null]]) {
		assert.deepEqual(problemsOf({ tenants: one({ id: "x", on, [name]: value }) }), [p(`/tenants/0/rows/0/${name}`, "invalid-value")], `${name}: ${label(value)}`);
	}
	for (const name of ["id", "on", "when"]) {
		const r = { id: "x", on };
		delete r[name];
		assert.deepEqual(problemsOf({ tenants: one(accessor(r, name)) }), [p(`/tenants/0/rows/0/${name}`, "invalid-value")], `an accessor ${name}`);
	}
	const payload = accessor({ id: "x", on, run: undefined, said: null }, "doc", () => assert.fail("a payload getter ran"));
	const composed = composeBindingTable({ tenants: one(payload) });
	assert.equal(composed.ok, true, "a payload accessor or undefined is never inspected");
	assert.equal(composed.table.rows[0].row, payload);
});

test("IB3 step 9: a declared flag not a boolean, the opens field not a non-empty string, undefined among them", () => {
	const declaration = (r) => ({ guards: [GUARD], claim: { flag: "claims", default: true }, opens: { field: "opens" }, tenants: one(r) });
	for (const [name, value] of [["quiet", "yes"], ["quiet", 1], ["quiet", undefined], ["claims", null], ["claims", undefined], ["opens", ""], ["opens", 5], ["opens", undefined], ["opens", null]]) {
		assert.deepEqual(problemsOf(declaration(row("x", { [name]: value }))), [p(`/tenants/0/rows/0/${name}`, "invalid-value")], `${name}: ${label(value)}`);
	}
	for (const name of ["quiet", "claims", "opens"]) assert.deepEqual(problemsOf(declaration(accessor(row("x"), name))), [p(`/tenants/0/rows/0/${name}`, "invalid-value")], `an accessor ${name}`);
	// step 9 checks a row whose id is invalid too: a sibling, not beneath
	assert.deepEqual(problemsOf(declaration({ id: "", on, quiet: "no" })), [p("/tenants/0/rows/0/id", "invalid-value"), p("/tenants/0/rows/0/quiet", "invalid-value")]);
});

test("IB3 step 9 is skipped after any problem at or beneath /guards, /claim or /opens, a duplicate-field among them", () => {
	const r = row("x", { quiet: "no", claims: 1, opens: "" });
	assert.deepEqual(problemsOf({ guards: [GUARD, 5], claim: { flag: "claims", default: true }, opens: { field: "opens" }, tenants: one(r) }), [p("/guards/1", "not-an-object")]);
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "claims", default: true, extra: 1 }, opens: { field: "opens" }, tenants: one(r) }), [p("/claim/extra", "unknown-property")]);
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "claims", default: true }, opens: { field: "opens", x: 1 }, tenants: one(r) }), [p("/opens/x", "unknown-property")]);
	assert.deepEqual(problemsOf({ guards: [GUARD], claim: { flag: "quiet", default: true }, tenants: one(r) }), [p("/claim/flag", "duplicate-field")]);
	assert.deepEqual(problemsOf({ guards: 5, tenants: one(r) }), [p("/guards", "invalid-value")]);
});

test("IB3 step 10: an id equal to an earlier row's, across tenants, judged among valid ids only", () => {
	assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows: [row("x"), row("y")] }, { owner: "b", rows: [row("x"), row("x")] }] }), [p("/tenants/1/rows/0/id", "duplicate-id"), p("/tenants/1/rows/1/id", "duplicate-id")]);
	assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows: [{ id: 5, on }, row("5")] }] }), [p("/tenants/0/rows/0/id", "invalid-value")]);
	assert.deepEqual(problemsOf({ tenants: [{ owner: "", rows: [row("x")] }, { owner: "b", rows: [row("x")], extra: 1 }] }), [p("/tenants/0/owner", "invalid-value"), p("/tenants/1/extra", "unknown-property"), p("/tenants/1/rows/0/id", "duplicate-id")]);
});

test("IB3: a problem beneath one member never suppresses its sibling's; problems are ordered by code unit and appear once", () => {
	assert.deepEqual(problemsOf({ tenants: [5, { owner: "", rows: [] }] }), [p("/tenants/0", "not-an-object"), p("/tenants/1/owner", "invalid-value")]);
	const tenants = Array.from({ length: 11 }, (_, i) => ({ owner: i === 2 || i === 10 ? "" : "a", rows: [] }));
	assert.deepEqual(problemsOf({ tenants }), [p("/tenants/10/owner", "invalid-value"), p("/tenants/2/owner", "invalid-value")], "'/tenants/10' sorts before '/tenants/2'");
	assert.deepEqual(problemsOf({ tenants: [], B: 1, a: 1, "\u00e9": 1, Z: 1 }), [p("/B", "unknown-property"), p("/Z", "unknown-property"), p("/a", "unknown-property"), p("/\u00e9", "unknown-property")]);
	const both = problemsOf({ guards: [{}], tenants: [{ owner: "a", rows: [{}] }] });
	assert.deepEqual(both.map((x) => x.pointer), [...both.map((x) => x.pointer)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});

test("I1: Proxy values -- a revoked or trapping one refused at its pointer, a transparent one answered as its target", () => {
	const valid = { guards: [GUARD], claim: { flag: "claims", default: true }, opens: { field: "opens" }, tenants: one(row("x", { opens: "g" })) };
	const transparent = (v) => new Proxy(v, {});
	const proxied = transparent({ guards: transparent([transparent(GUARD)]), claim: transparent(valid.claim), opens: transparent(valid.opens), tenants: transparent([transparent({ owner: "a", rows: transparent([transparent(valid.tenants[0].rows[0])]) })]) });
	const result = composeBindingTable(proxied);
	assert.equal(result.ok, true);
	assert.deepEqual(result.table.rows.map((e) => [e.id, e.owner, e.opens]), [["x", "a", "g"]]);
	assert.deepEqual(problemsOf({ guards: [trapping(GUARD, "getOwnPropertyDescriptor")], tenants: [] }), [p("/guards/0", "not-an-object")]);
	assert.deepEqual(problemsOf({ tenants: trapping([], "ownKeys") }), [p("/tenants", "invalid-value")]);
	assert.deepEqual(problemsOf({ tenants: [trapping({ owner: "a", rows: [] }, "getPrototypeOf")] }), [p("/tenants/0", "not-an-object")]);
	assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows: revoked([]) }] }), [p("/tenants/0/rows", "invalid-value")]);
	assert.deepEqual(problemsOf({ claim: trapping({ flag: "c", default: true }, "ownKeys"), tenants: [] }), [p("/claim", "not-an-object")]);
});

test("IB2 rule 8: a declaration is read value by value, each judged at its own pointer before anything beneath it, nothing twice", () => {
	const log = [];
	const g0 = recorded({ ...GUARD }, "g0", log);
	const guards = recorded([g0], "guards", log);
	const claim = recorded({ flag: "claims", default: true }, "claim", log);
	const opens = recorded({ field: "opens" }, "opens", log);
	const r0 = recorded({ id: "x", on, run: "act", quiet: true, opens: "g" }, "r0", log);
	const r1 = recorded({ id: "y", on, when: on }, "r1", log);
	const rows = recorded([r0, r1], "rows", log);
	const t0 = recorded({ owner: "a", rows }, "t0", log);
	const tenants = recorded([t0], "tenants", log);
	const declaration = recorded({ tenants, opens, claim, guards }, "declaration", log);
	assert.equal(composeBindingTable(declaration).ok, true);
	const array = (label, n) => [`${label} getPrototypeOf`, `${label} ownKeys`, `${label} getOwnPropertyDescriptor length`, ...Array.from({ length: n }, (_, i) => `${label} getOwnPropertyDescriptor ${i}`)];
	const record = (label, names) => [`${label} getPrototypeOf`, `${label} ownKeys`, ...names.map((n) => `${label} getOwnPropertyDescriptor ${n}`)];
	assert.deepEqual(log, [
		...record("declaration", ["guards", "claim", "opens", "tenants"]),
		...array("guards", 1),
		...record("g0", ["state", "flag", "default", "refuses"]),
		...record("claim", ["flag", "default"]),
		...record("opens", ["field"]),
		...array("tenants", 1),
		...record("t0", ["owner", "rows"]),
		...array("rows", 2),
		...record("r0", ["id", "on", "quiet", "opens"]),
		...record("r1", ["id", "on", "when"]),
	]);
});

test("IB2 rule 8: a declaration that is refused is read the same way, and nothing beneath a value refused at its pointer is read", () => {
	const log = [];
	const bad = recorded({ id: "z", on }, "bad", log);
	const rows = recorded([bad], "rows", log);
	const t0 = recorded({ owner: "a", rows, extra: 1 }, "t0", log);
	const t1 = recorded(Object.create({}), "t1", log);
	const g0 = recorded({ ...GUARD }, "g0", log);
	const guards = recorded(Object.assign([g0], { extra: 1 }), "guards", log);
	const declaration = recorded({ guards, tenants: [t0, t1], unknown: 1 }, "declaration", log);
	assert.deepEqual(problemsOf(declaration), [p("/guards", "invalid-value"), p("/tenants/0/extra", "unknown-property"), p("/tenants/1", "not-an-object"), p("/unknown", "unknown-property")]);
	assert.deepEqual(log, [
		"declaration getPrototypeOf",
		"declaration ownKeys",
		"declaration getOwnPropertyDescriptor guards",
		"declaration getOwnPropertyDescriptor tenants",
		"guards getPrototypeOf",
		"guards ownKeys",
		"t0 getPrototypeOf",
		"t0 ownKeys",
		"t0 getOwnPropertyDescriptor owner",
		"t0 getOwnPropertyDescriptor rows",
		"rows getPrototypeOf",
		"rows ownKeys",
		"rows getOwnPropertyDescriptor length",
		"rows getOwnPropertyDescriptor 0",
		"bad getPrototypeOf",
		"bad ownKeys",
		"bad getOwnPropertyDescriptor id",
		"bad getOwnPropertyDescriptor on",
		"t1 getPrototypeOf",
	]);
});

test("IB2 rule 8, reading 4: a guards array whose second element is an accessor is refused before its first is read; the tenants stay as they were", () => {
	let ran = false;
	const declaration = { tenants: [{ owner: "a", rows: [{ id: "", on }] }] };
	const g0 = new Proxy(
		{ ...GUARD },
		{
			getPrototypeOf(t) {
				ran = true;
				declaration.tenants.length = 0;
				return Reflect.getPrototypeOf(t);
			},
		},
	);
	declaration.guards = accessor([g0], 1, () => GUARD);
	assert.deepEqual(problemsOf(declaration), [p("/guards", "invalid-value"), p("/tenants/0/rows/0/id", "invalid-value")]);
	assert.equal(ran, false, "the first element's trap never ran");
});

test("IB2: a phantom key -- listed by its own keys, its descriptor undefined -- is absent where IB2's order reads its descriptor, and known by its key alone where it reads none", () => {
	assert.deepEqual(problemsOf(phantom({}, "tenants")), [p("/tenants", "missing-property")], "a named property whose descriptor reads undefined is absent");
	assert.deepEqual(problemsOf(phantom({ tenants: [] }, "zz")), [p("/zz", "unknown-property")], "a property the form does not name is known by its key alone");
	assert.equal(composeBindingTable(phantom({ tenants: [] }, "guards", "claim", "opens")).ok, true, "optional properties whose descriptors read undefined are absent");
	assert.deepEqual(problemsOf({ guards: [phantom({ state: "s", default: false, refuses: "state-and-flag" }, "flag")], tenants: [] }), [p("/guards/0/flag", "missing-property")]);
	assert.deepEqual(problemsOf({ tenants: [{ owner: "a", rows: [phantom({ on }, "id")] }] }), [p("/tenants/0/rows/0/id", "missing-property")]);
	const composed = composeBindingTable({ opens: { field: "g" }, guards: [{ state: "s", flag: "f", default: true, refuses: "state-and-flag" }], tenants: [{ owner: "a", rows: [phantom({ id: "x", on }, "when", "g", "f")] }] });
	assert.equal(composed.ok, true, "a row's phantom when, flag and opens field are absent");
	assert.equal(composed.table.rows[0].opens, null);
	assert.equal(composed.table.traceInput(null, null, { s: true })[0].refusedBy, "f", "the absent flag takes its default");
	const log = [];
	problemsOf(recorded(phantom({ tenants: [] }, "zz", "tenantz"), "declaration", log));
	assert.deepEqual(log, ["declaration getPrototypeOf", "declaration ownKeys", "declaration getOwnPropertyDescriptor tenants"], "no descriptor is read of a key the form does not name, phantom or not");
	const holeLog = [];
	assert.deepEqual(problemsOf({ tenants: recorded(phantom([, { owner: "a", rows: [] }], "0"), "tenants", holeLog) }), [p("/tenants", "invalid-value")], "a phantom index is a hole");
	assert.deepEqual(holeLog, ["tenants getPrototypeOf", "tenants ownKeys", "tenants getOwnPropertyDescriptor length", "tenants getOwnPropertyDescriptor 0"], "judged absent at its own descriptor");
	assert.deepEqual(problemsOf({ tenants: phantom([], "extra") }), [p("/tenants", "invalid-value")], "a phantom key that is no index is another own string-named property");
});

test("IB2 rule 4: an array's index is a canonical integer string below 2^32 - 1, so \"4294967295\" is another own property, refused at its own keys, before its length is read", () => {
	for (const key of ["4294967295", "4294967296", "01", "1.0", "-1", "1e3"]) {
		const list = [];
		list[key] = 1;
		const log = [];
		assert.deepEqual(problemsOf({ tenants: recorded(list, "tenants", log) }), [p("/tenants", "invalid-value")], key);
		assert.deepEqual(log, ["tenants getPrototypeOf", "tenants ownKeys"], `"${key}" is no index: refused before the length is read`);
	}
	const log = [];
	const sparse = [];
	sparse[4294967294] = 1;
	assert.deepEqual(problemsOf({ tenants: recorded(sparse, "tenants", log) }), [p("/tenants", "invalid-value")]);
	assert.deepEqual(log, ["tenants getPrototypeOf", "tenants ownKeys", "tenants getOwnPropertyDescriptor length"], "\"4294967294\" is the greatest index: the array is refused as sparse, after its length is read");
});

test("IB4: table order, entries { id, owner, opens, row } in that order, defaults for omitted flags, opens null without a declaration", () => {
	const r0 = row("x", { gesture: "drag", quiet: true });
	const r1 = row("y");
	const r2 = row("z", { gesture: "box" });
	const opened = composeBindingTable({ opens: { field: "gesture" }, guards: [GUARD], tenants: [{ owner: "b", rows: [r0, r1] }, { owner: "a", rows: [r2] }] });
	assert.equal(opened.ok, true);
	const { table } = opened;
	assert.deepEqual(table.rows.map((e) => Object.keys(e)), [0, 1, 2].map(() => ["id", "owner", "opens", "row"]));
	assert.deepEqual(table.rows.map((e) => [e.id, e.owner, e.opens]), [["x", "b", "drag"], ["y", "b", null], ["z", "a", "box"]]);
	assert.ok(table.rows[0].row === r0 && table.rows[1].row === r1 && table.rows[2].row === r2, "each entry's row is the declared object itself");
	assert.deepEqual(Object.keys(table), ["rows", "guards", "claim", "opens", "traceInput", "matchInput", "findOverlaps"]);
	assert.deepEqual(table.guards, [GUARD]);
	assert.notEqual(table.guards[0], GUARD, "a copy");
	assert.deepEqual(Object.keys(table.guards[0]), ["state", "flag", "default", "refuses"]);
	assert.deepEqual(table.opens, { field: "gesture" });
	assert.equal(table.claim, null);
	// the guard's default (false) is the omitted flag's: refused while busy, unless the row says quiet
	assert.deepEqual(table.traceInput(null, null, { busy: true }).map((t) => t.refusedBy), [null, "quiet", "quiet"]);
	const plain = composeBindingTable({ tenants: one(row("x", { gesture: "drag" })) });
	assert.equal(plain.table.rows[0].opens, null, "no opens declared: every row's opens is null");
	assert.equal(plain.table.opens, null);
	const claimed = composeBindingTable({ claim: { default: true, flag: "c" }, tenants: [] });
	assert.deepEqual(Object.keys(claimed.table.claim), ["flag", "default"]);
	assert.deepEqual(claimed.table.claim, { flag: "c", default: true });
	assert.ok(isFrozenToDepth(opened, new Set([r0, r1, r2])));
	assert.ok(!Object.isFrozen(r0) && !Object.isFrozen(r1), "no row frozen");
});

test("IB4 and IB2: a row's opens field absent gives null; present as undefined is refused", () => {
	const table = composeBindingTable({ opens: { field: "g" }, tenants: one(row("x"), row("y", { g: "drag" })) }).table;
	assert.deepEqual(table.rows.map((e) => e.opens), [null, "drag"]);
	assert.deepEqual(problemsOf({ opens: { field: "g" }, tenants: one(row("x", { g: undefined })) }), [p("/tenants/0/rows/0/g", "invalid-value")]);
});

test("I2: a table reads each row once and owns nothing else of it -- a row changed after composition changes no answer", () => {
	const r0 = { id: "x", on: (f) => f === 1, when: (c) => c === "c", quiet: false, gesture: "drag" };
	const opened = composeBindingTable({ guards: [GUARD], opens: { field: "gesture" }, claim: { flag: "claims", default: false }, tenants: one(r0) });
	const { table } = opened;
	const before = [table.traceInput(1, "c"), table.matchInput(1, "c", { busy: true }), table.matchInput(1, "c")];
	Object.assign(r0, { id: "changed", on: () => false, when: () => false, quiet: true, gesture: "other", claims: true });
	const after = [table.traceInput(1, "c"), table.matchInput(1, "c", { busy: true }), table.matchInput(1, "c")];
	assert.deepEqual(after, before);
	assert.equal(after[2].match.row, r0, "the row itself, as it now is");
	assert.equal(after[2].match.id, "x");
	assert.equal(after[2].match.opens, "drag");
	assert.equal(after[2].claimed, false);
});

test("I2: a payload getter is never called -- at composition, in a trace, a match or an overlap", () => {
	const r0 = accessor(row("x"), "run", () => assert.fail("the payload getter ran"));
	const r1 = accessor(row("y"), "said", () => assert.fail("the payload getter ran"));
	const { table } = composeBindingTable({ tenants: one(r0, r1) });
	table.traceInput(0, 0);
	assert.equal(table.matchInput(0, 0).match, null);
	assert.equal(table.findOverlaps([0], [0], [{}]).length, 1);
	assert.equal(table.rows[0].row, r0);
});
