// beside-0.2.0 - I22, and the guard that a declaration without measure is 0.2.0's in every rule: this build
// run beside the released 0.2.0, its release file a development dependency under the name input-binding-0.2.0,
// pinned by its URL and the lockfile's integrity, nothing of it kept in the repository, and each of its built
// files pinned again below by its SHA-256 (docs/DECISIONS.md, D6). With no projection -- 0.3.0
// adds nothing to a session declared without measure -- every problem, declaration, state, outcome, refusal
// and identity equals 0.2.0's over a table of declarations, IB11's decided cases, the I13 corpus and I10's
// generator with pointers and keys; every argument is read as 0.2.0 read it, the declaration's measure
// descriptor read after the others; and the one difference is a declaration naming measure, which 0.2.0
// refused as an unknown property.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as current from "@apnex/input-binding";
import * as released from "input-binding-0.2.0";
import { DECIDED_CASES, DECIDED_GESTURES, runDecidedCase } from "../support/decided-cases.js";
import { randomTools, seededRandom } from "../support/doubles.js";
import { describe, isFrozenToDepth } from "../support/frozen.js";
import { applyToSession, randomOperation } from "../support/lifecycle-model.js";
import { recorded, revoked, trapping } from "../support/recording-proxy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const installed = path.join(here, "..", "..", "node_modules", "input-binding-0.2.0");
const dist = path.join(installed, "dist");
const corpus = JSON.parse(fs.readFileSync(path.join(here, "..", "corpus", "i13-corpus.json"), "utf8"));

/** The released 0.2.0's built files, as its release tarball holds them, each file's SHA-256 in base64. */
const PINS = {
	"argument-reading.js": "xRemMfJruNjpZy9qWD2zwCiBYNd32wJgcE4pqogcun0=",
	"binding-declaration.js": "rQLcJDcH03RWHEalryARSTxK15Yq5/7EHvFfmxz8jjc=",
	"binding-table.js": "bq3JtNsRRP0/FQsgBoj0lzWWuf4kJ2E9VDnashYY5/M=",
	"declaration-problems.js": "Ph3KJytaWw4ivz/j0ZsHwpeGfYWN5dIdhRY9NduYlTM=",
	"gesture-session.js": "Fy/IBN7zLSO1fQgprvLFL2NAgadPV4FAyfagxlV0vpQ=",
	"index.js": "dX7DsWdidm/FzgC3YuOuYfT81swqZS/wa44YzymS1SQ=",
	"reflection.js": "vSHkuZhjAjyDZ8NVVzd1bwoAhaC+bssTIsxfZ4jNfY4=",
	"session-declaration.js": "AMnNirBVJnYZXfMbQlSQgW9UaYb97nt/xvIgrquumcw=",
	"travel-beyond.js": "+VTvrNWHkysO5xvQk1kva+EVQmPBtvQ/E/1ZE41ehCo=",
	"types.js": "WW163QCPiHavCAAInas61ES32N7qhXpaNO5GBycR4g0=",
};

const GESTURES = [
	{ name: "pending", engaged: false, button: null },
	{ name: "move", engaged: true, button: null },
	{ name: "chain", engaged: true, button: 0 },
	{ name: "pan", engaged: true, button: 1 },
];

/** A value as a test compares it: plain data, -0 and undefined kept apart, every record's key order kept. */
const plain = (value) => describe(value);
/** Whether each of an outcome's state, press, press point, gesture and keys is the very same value as before. */
const identities = (before, outcome) => [outcome.state === before, outcome.state.press === before.press, outcome.state.press?.at === before.press?.at, outcome.state.gesture === before.gesture, outcome.state.keys === before.keys];
/** What a call answered: its outcome as plain data, or the kind of its refusal and the function it names. */
const answer = (call) => {
	try {
		return { outcome: plain(call()) };
	} catch (error) {
		return { refused: error.constructor.name, by: error.message.split(":")[0] };
	}
};

test("the development dependency is the released 0.2.0: its package, each built file as pinned, and the very session this build opens without measure, frozen as 0.2.0's", () => {
	const pkg = JSON.parse(fs.readFileSync(path.join(installed, "package.json"), "utf8"));
	assert.deepEqual([pkg.name, pkg.version], ["@apnex/input-binding", "0.2.0"]);
	assert.deepEqual(fs.readdirSync(dist).filter((f) => f.endsWith(".js")).sort(), Object.keys(PINS));
	for (const [file, pin] of Object.entries(PINS)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(dist, file))).digest("base64"), pin, file);
	const old = released.openGestureSession({ threshold: -0, gestures: GESTURES }).session;
	const now = current.openGestureSession({ threshold: -0, gestures: GESTURES }).session;
	assert.deepEqual(Reflect.ownKeys(now), Reflect.ownKeys(old));
	assert.deepEqual(Reflect.ownKeys(now.declaration), Reflect.ownKeys(old.declaration));
	assert.deepEqual(now.declaration.gestures.map((g) => Reflect.ownKeys(g)), old.declaration.gestures.map((g) => Reflect.ownKeys(g)));
	assert.equal(plain(now.declaration), plain(old.declaration));
	assert.deepEqual([Object.isFrozen(now), isFrozenToDepth(now.declaration), Object.is(now.declaration.threshold, 0)], [Object.isFrozen(old), isFrozenToDepth(old.declaration), Object.is(old.declaration.threshold, 0)]);
	assert.deepEqual([Object.isFrozen(now), isFrozenToDepth(now.declaration)], [true, true]);
	assert.equal(plain(now.state), plain(old.state));
	assert.deepEqual(Object.keys(current), Object.keys(released));
});

test("I22: every declaration without measure is opened or refused as 0.2.0 opens or refuses it -- every problem, every declaration -- and one naming measure is the one difference", () => {
	const declarations = [
		undefined, null, 4, "x", [], () => {}, new (class Declaration {})(), Object.create({ threshold: 4, gestures: [] }),
		{}, { threshold: 4 }, { gestures: [] }, { threshold: 4, gestures: [] }, { threshold: -0, gestures: GESTURES }, Object.assign(Object.create(null), { threshold: 0, gestures: [] }),
		{ threshold: -1, gestures: [] }, { threshold: Infinity, gestures: [] }, { threshold: NaN, gestures: [] }, { threshold: "4", gestures: [] }, { threshold: undefined, gestures: [] },
		{ threshold: 4, gestures: {} }, { threshold: 4, gestures: [null, 4, { name: "" }] }, { threshold: 4, gestures: [{ name: "a", engaged: 1, button: 1.5 }] },
		{ threshold: 4, gestures: [{ name: "a", engaged: true, button: null }, { name: "a", engaged: false, button: 0 }] }, { threshold: 4, gestures: [{ name: "a", engaged: true, button: -0, extra: 1 }] },
		{ threshold: 4, gestures: [], extra: 1, other: undefined }, { threshold: 4, gestures: [], [Symbol("s")]: 1 }, { threshold: 4, gestures: Object.assign([], { length: 1 }) },
		revoked({ threshold: 4, gestures: [] }), trapping({ threshold: 4, gestures: [] }, "ownKeys"), trapping({ threshold: 4, gestures: [] }, "getPrototypeOf"), { threshold: 4, gestures: revoked([]) },
		new Proxy({ threshold: 4, gestures: GESTURES }, {}),
	];
	const accessor = { gestures: [] };
	Object.defineProperty(accessor, "threshold", { get: () => 4, enumerable: true });
	declarations.push(accessor);
	let opened = 0;
	for (const [i, declaration] of declarations.entries()) {
		const [a, b] = [released.openGestureSession(declaration), current.openGestureSession(declaration)];
		assert.equal(b.ok, a.ok, `declaration ${i}`);
		if (a.ok) assert.equal(plain(b.session.declaration), plain(a.session.declaration), `declaration ${i}`);
		else assert.equal(plain(b), plain(a), `declaration ${i}`);
		opened += a.ok ? 1 : 0;
	}
	assert.equal(opened, 5, "five of them opened -- a symbol-named property ignored -- and the rest refused");
	// the one difference: a declaration naming measure, which 0.2.0 refused as an unknown property
	for (const measure of ["at", "screen", "pixels", undefined]) {
		const declaration = { threshold: 4, gestures: [], measure };
		assert.equal(plain(released.openGestureSession(declaration)), plain({ ok: false, problems: [{ pointer: "/measure", problem: "unknown-property" }] }));
		const opened = current.openGestureSession(declaration);
		if (measure === "at" || measure === "screen") assert.equal(plain(opened.session.declaration), plain({ threshold: 4, gestures: [], measure }));
		else assert.equal(plain(opened), plain({ ok: false, problems: [{ pointer: "/measure", problem: "invalid-value" }] }));
	}
});

test("I22: IB11's decided cases close with 0.2.0's phases, and every step's outcome is 0.2.0's", () => {
	for (const [label, steps, , phase] of DECIDED_CASES) {
		const old = released.openGestureSession({ threshold: 4, gestures: DECIDED_GESTURES }).session;
		const fresh = current.openGestureSession({ threshold: 4, gestures: DECIDED_GESTURES }).session;
		const [a, b] = [runDecidedCase(old, steps), runDecidedCase(fresh, steps)];
		assert.equal(b.outcome.phase, phase, label);
		assert.equal(plain(b.outcome), plain(a.outcome), label);
		assert.equal(plain(b.before), plain(a.before), label);
	}
});

/** Runs one corpus step on a session, as test/corpus/i13-corpus.test.js does; answers the outcome. */
function corpusStep(session, [op, x, y]) {
	if (op === "up") return session.pointerUp({ button: 0 });
	if (op === "down") return session.pointerDown({ at: { x, y }, button: 0 });
	if (op === "move") return session.pointerMove({ at: { x, y } });
	if (op === "lost") return session.pointerLost();
	if (op === "restart") return (session.state.gesture === null ? session.startGesture : session.becomeGesture)({ gesture: "g", from: { x, y } });
	throw new Error(`no step ${op}`);
}

test("I22: over every stream of the I13 corpus, those listed apart among them, the session answers as 0.2.0 does, outcome for outcome, identity for identity", () => {
	let steps = 0;
	for (const { steps: stream } of [...corpus.streams, ...corpus.apart]) {
		const declaration = { threshold: corpus.threshold, gestures: [{ name: "g", engaged: true, button: null }] };
		const old = released.openGestureSession(declaration).session;
		const fresh = current.openGestureSession(declaration).session;
		for (const step of stream) {
			const [oldBefore, freshBefore] = [old.state, fresh.state];
			const [a, b] = [corpusStep(old, step), corpusStep(fresh, step)];
			assert.equal(plain(b), plain(a), JSON.stringify(step));
			assert.deepEqual(identities(freshBefore, b), identities(oldBefore, a), JSON.stringify(step));
			steps++;
		}
	}
	assert.ok(steps > 10000, `${steps} steps compared`);
});

test("I22: over I10's generator, with two pointers and the keys, every outcome, refusal and identity is 0.2.0's", () => {
	const declaration = { threshold: 4, gestures: GESTURES };
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	const keyOperation = () => pick([{ kind: "keyDown", code: pick(["KeyA", "Space", "", null]) }, { kind: "keyUp", code: pick(["KeyA", "Space", "", null]) }, { kind: "keysLost" }]);
	let compared = 0, refused = 0;
	for (let n = 0; n < 600; n++) {
		const old = released.openGestureSession(declaration).session;
		const fresh = current.openGestureSession(declaration).session;
		for (let k = int(5, 40); k > 0; k--) {
			const op = chance(0.15) ? keyOperation() : randomOperation({ int, pick, chance }, GESTURES);
			if (chance(0.5)) op.pointer = pick([1, 2]);
			const [oldBefore, freshBefore] = [old.state, fresh.state];
			const [a, b] = [answer(() => applyToSession(old, op)), answer(() => applyToSession(fresh, op))];
			assert.deepEqual(b, a, describe(op));
			if (a.refused !== undefined) {
				assert.equal(fresh.state, freshBefore);
				refused++;
				continue;
			}
			assert.deepEqual([fresh.state === freshBefore, fresh.state.press === freshBefore.press, fresh.state.gesture === freshBefore.gesture, fresh.state.keys === freshBefore.keys], [old.state === oldBefore, old.state.press === oldBefore.press, old.state.gesture === oldBefore.gesture, old.state.keys === oldBefore.keys], describe(op));
			compared++;
		}
	}
	assert.ok(compared > 8000 && refused > 100, `${compared} compared, ${refused} refused`);
});

test("I22: every argument of every operation is read as 0.2.0 read it, and the reading stops where 0.2.0's stopped; a declaration's measure descriptor is read after the others, and nothing else", () => {
	const declaration = { threshold: 4, gestures: [{ name: "move", engaged: true, button: null }, { name: "chain", engaged: true, button: 0 }] };
	const calls = [
		["pointerDown", (log) => [recorded({ at: recorded({ x: 1, y: 2 }, "at", log), screen: recorded({ x: 9, y: 9 }, "screen", log), button: 0, pointerId: 1, key: "k" }, "fact", log)]],
		["pointerMove", (log) => [recorded({ at: recorded({ x: 1, y: 2 }, "at", log), screen: recorded({ x: 9, y: 9 }, "screen", log), button: 0 }, "fact", log)]],
		["pointerUp", (log) => [recorded({ at: { x: 0, y: 0 }, screen: { x: 0, y: 0 }, button: 0 }, "fact", log)]],
		["pressMatched", (log) => [recorded({ id: "r", opens: null, owner: "o", row: {} }, "match", log)]],
		["startGesture", (log) => [recorded({ gesture: "move", row: "r", from: recorded({ x: 1, y: 1 }, "from", log) }, "args", log)]],
		["becomeGesture", (log) => [recorded({ gesture: "chain", from: recorded({ x: 1, y: 1 }, "from", log) }, "args", log)]],
		["resolvePress", (log) => [recorded({ at: recorded({ x: 1, y: 2 }, "at", log), screen: { x: 9, y: 9 }, button: 0 }, "fact", log), recorded({ match: () => ({ id: "r", opens: "move" }) }, "handlers", log)]],
		["keyDown", (log) => [recorded({ code: "KeyA", key: "a" }, "fact", log)]],
		["pointerDown", (log) => [recorded({ at: recorded({ x: NaN, y: 2 }, "at", log), button: 0 }, "fact", log)]],
		["pointerDown", (log) => [recorded({ at: { x: 0, y: 0 }, button: "0", pointerId: 1 }, "fact", log)]],
		["pointerMove", (log) => [recorded({ screen: { x: 0, y: 0 }, pointerId: 1 }, "fact", log)]],
		["pointerUp", (log) => [recorded({ button: 1.5 }, "fact", log)]],
		["resolvePress", (log) => [recorded({ at: { x: 0, y: 0 }, button: 0 }, "fact", log), recorded({ match: 1 }, "handlers", log)]],
	];
	for (const [fn, args] of calls) {
		const logs = [];
		for (const module of [released, current]) {
			const s = module.openGestureSession(declaration).session;
			s.pointerDown({ at: { x: 0, y: 0 }, button: 1 });
			if (fn === "becomeGesture") s.startGesture({ gesture: "move" });
			const log = [];
			const outcome = answer(() => s[fn](...args(log)));
			logs.push({ log, outcome });
		}
		assert.deepEqual(logs[1], logs[0], fn);
	}
	const reads = (module, measure) => {
		const log = [];
		const gestures = recorded([recorded({ name: "move", engaged: true, button: null }, "gesture", log)], "gestures", log);
		module.openGestureSession(recorded(measure === undefined ? { threshold: 4, gestures } : { threshold: 4, gestures, measure }, "declaration", log));
		return log;
	};
	const before = reads(released, undefined);
	assert.deepEqual(reads(current, undefined), before, "a declaration without measure is read as 0.2.0 read it");
	const withMeasure = reads(current, "screen");
	const at = before.indexOf("declaration getOwnPropertyDescriptor gestures") + 1;
	assert.deepEqual(withMeasure, [...before.slice(0, at), "declaration getOwnPropertyDescriptor measure", ...before.slice(at)], "with measure, its descriptor alone is added, after gestures'");
});
