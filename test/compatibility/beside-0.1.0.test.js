// beside-0.1.0 - I19, and the guardrail that a 0.1.0 declaration, fact and sequence behaves as under 0.1.0
// but for the changes CONTRACT.md lists: this build run beside the released 0.1.0, whose built files are kept
// in test/fixtures/input-binding-0.1.0/, each pinned below by its SHA-256 (docs/DECISIONS.md, D3, says where
// they came from). Over IB11's decided cases, the I13 corpus and I10's generator, their facts carrying no
// pointerId, every answer of 0.2.0 equals 0.1.0's once the press's button and pointer, the state's keys and
// the outcomes' otherPointer are set aside, but for the chord sequences, each listed with both answers; and
// every argument is read as 0.1.0 read it, pointerId's descriptor read after.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import * as current from "@apnex/input-binding";
import * as released from "../fixtures/input-binding-0.1.0/index.js";
import { DECIDED_CASES, DECIDED_GESTURES, runDecidedCase } from "../support/decided-cases.js";
import { randomTools, seededRandom } from "../support/doubles.js";
import { describe } from "../support/frozen.js";
import { applyToSession, randomOperation } from "../support/lifecycle-model.js";
import { recorded } from "../support/recording-proxy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(here, "..", "fixtures", "input-binding-0.1.0");
const corpus = JSON.parse(fs.readFileSync(path.join(here, "..", "corpus", "i13-corpus.json"), "utf8"));

/** The released 0.1.0's built files, as its release tarball holds them, each file's SHA-256 in base64. */
const PINS = {
	"argument-reading.js": "xRemMfJruNjpZy9qWD2zwCiBYNd32wJgcE4pqogcun0=",
	"binding-declaration.js": "rQLcJDcH03RWHEalryARSTxK15Yq5/7EHvFfmxz8jjc=",
	"binding-table.js": "bq3JtNsRRP0/FQsgBoj0lzWWuf4kJ2E9VDnashYY5/M=",
	"declaration-problems.js": "Ph3KJytaWw4ivz/j0ZsHwpeGfYWN5dIdhRY9NduYlTM=",
	"gesture-session.js": "pdZMKtrQTzZcS2jReNu7f2S8SsOuZjKHdRnUycpYDHE=",
	"index.js": "dX7DsWdidm/FzgC3YuOuYfT81swqZS/wa44YzymS1SQ=",
	"reflection.js": "vSHkuZhjAjyDZ8NVVzd1bwoAhaC+bssTIsxfZ4jNfY4=",
	"session-declaration.js": "AMnNirBVJnYZXfMbQlSQgW9UaYb97nt/xvIgrquumcw=",
	"travel-beyond.js": "+VTvrNWHkysO5xvQk1kva+EVQmPBtvQ/E/1ZE41ehCo=",
	"types.js": "WW163QCPiHavCAAInas61ES32N7qhXpaNO5GBycR4g0=",
};

/** An outcome with what 0.2.0 adds set aside: the press's button and pointer, the state's keys, otherPointer. */
function project(outcome) {
	const press = (p) => (p === null ? null : { at: { x: p.at.x, y: p.at.y }, beyond: p.beyond, unmatched: p.unmatched });
	const state = (s) => ({ press: press(s.press), gesture: s.gesture === null ? null : { ...s.gesture } });
	const out = {};
	for (const [key, value] of Object.entries(outcome)) {
		if (key === "otherPointer") continue;
		if (key === "state") out.state = state(value);
		else if ((key === "gesture" || key === "was") && value !== null) out[key] = { ...value };
		else out[key] = value;
	}
	return out;
}

/** Whether each of an outcome's state, press and gesture is the very same value as before. */
const identities = (before, outcome) => [outcome.state === before, outcome.state.press === before.press, outcome.state.gesture === before.gesture];

test("the fixture is the released 0.1.0: its built files, each as pinned, its session of eight operations and a press with no button", () => {
	assert.deepEqual(fs.readdirSync(fixture).sort(), Object.keys(PINS));
	for (const [file, pin] of Object.entries(PINS)) assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(fixture, file))).digest("base64"), pin, file);
	const { session } = released.openGestureSession({ threshold: 4, gestures: [] });
	assert.deepEqual(Object.keys(session), ["declaration", "state", "pointerDown", "pressMatched", "pointerMove", "pointerUp", "pointerLost", "startGesture", "becomeGesture", "cancelGesture"]);
	session.pointerDown({ at: { x: 0, y: 0 }, button: 3 });
	assert.deepEqual(Object.keys(session.state.press), ["at", "beyond", "unmatched"]);
	const now = current.openGestureSession({ threshold: 4, gestures: [] }).session;
	assert.deepEqual(Object.keys(now).slice(0, 10), Object.keys(session), "0.1.0's keys first, in its order; then the four 0.2.0 adds");
	assert.deepEqual(Object.keys(now).slice(10), ["resolvePress", "keyDown", "keyUp", "keysLost"]);
});

test("I19: IB11's decided cases -- the 0.1.0 column run on the released code, the 0.2.0 column on this build", () => {
	for (const [label, steps, then, now] of DECIDED_CASES) {
		const old = released.openGestureSession({ threshold: 4, gestures: DECIDED_GESTURES }).session;
		const fresh = current.openGestureSession({ threshold: 4, gestures: DECIDED_GESTURES }).session;
		assert.equal(runDecidedCase(old, steps).outcome.phase, then, `0.1.0: ${label}`);
		assert.equal(runDecidedCase(fresh, steps).outcome.phase, now, `0.2.0: ${label}`);
	}
	const changed = DECIDED_CASES.filter(([, , then, now]) => then !== now).map(([label]) => label);
	assert.deepEqual(changed, ["down 0 opening g0; the right button pressed and the left released, as moves; up 2", "down 3 opening g3; the left button pressed and button 3 released, as moves; up 0"], "the two chord cases, and no other, change their phase");
});

/** A row stated as data in the corpus, made into a row, as test/corpus/i13-corpus.test.js makes it. */
function predicateOf(fields, kind) {
	const [yes, no] = corpus.answerKinds[kind];
	const entries = Object.entries(fields);
	return (argument) => (entries.every(([k, v]) => argument[k] === v) ? yes : no);
}
function rowOf(spec) {
	const row = { ...spec, on: predicateOf(spec.on, spec.onAs) };
	delete row.onAs;
	delete row.whenAs;
	if (spec.when) row.when = predicateOf(spec.when, spec.whenAs);
	return row;
}
const declarationOf = (tenants) => ({ guards: corpus.guards, claim: corpus.claim, opens: corpus.opens, tenants: tenants.map((t) => ({ owner: t.owner, rows: t.rows.map(rowOf) })) });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("I19: over the I13 corpus's tables and refusals, the table answers as 0.1.0 does -- every match, claim, trace and overlap, and every problem", () => {
	let answers = 0;
	for (const t of corpus.tables) {
		const declaration = declarationOf(t.tenants);
		const old = released.composeBindingTable(declaration).table;
		const fresh = current.composeBindingTable(declaration).table;
		assert.deepEqual(plain(fresh.rows.map(({ id, owner, opens }) => ({ id, owner, opens }))), plain(old.rows.map(({ id, owner, opens }) => ({ id, owner, opens }))));
		assert.deepEqual([fresh.guards, fresh.claim, fresh.opens], [old.guards, old.claim, old.opens]);
		for (const g of [null, ...t.guardStates.keys()]) {
			for (const context of t.contexts) {
				for (const f of t.facts) {
					const args = g === null ? [f, context] : [f, context, t.guardStates[g]];
					assert.deepEqual(plain(fresh.traceInput(...args)), plain(old.traceInput(...args)));
					const [a, b] = [fresh.matchInput(...args), old.matchInput(...args)];
					assert.deepEqual([a.match?.id ?? null, a.claimed], [b.match?.id ?? null, b.claimed]);
					answers++;
				}
			}
		}
		assert.deepEqual(plain(fresh.findOverlaps(t.facts, t.contexts, t.guardStates).map((o) => o.ids)), plain(old.findOverlaps(t.facts, t.contexts, t.guardStates).map((o) => o.ids)));
	}
	for (const { tenants } of corpus.refusals) assert.deepEqual(current.composeBindingTable(declarationOf(tenants)), released.composeBindingTable(declarationOf(tenants)));
	assert.ok(answers > 2000, `${answers} answers compared`);
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

test("I19: over every stream of the I13 corpus -- those in agreement with its reference and those listed apart -- the session answers as 0.1.0 does, outcome for outcome, identity for identity", () => {
	let steps = 0;
	for (const { steps: stream } of [...corpus.streams, ...corpus.apart]) {
		const declaration = { threshold: corpus.threshold, gestures: [{ name: "g", engaged: true, button: null }] };
		const old = released.openGestureSession(declaration).session;
		const fresh = current.openGestureSession(declaration).session;
		for (const step of stream) {
			const [oldBefore, freshBefore] = [old.state, fresh.state];
			const [a, b] = [corpusStep(old, step), corpusStep(fresh, step)];
			assert.deepEqual(project(b), project(a), JSON.stringify(step));
			assert.deepEqual(identities(freshBefore, b), identities(oldBefore, a), JSON.stringify(step));
			steps++;
		}
	}
	assert.ok(steps > 10000, `${steps} steps compared`);
});

test("I19: over I10's generator, every outcome, refusal and identity is 0.1.0's but at a chord's release -- the release naming another button than the gesture's, of a press the gesture's button began -- where 0.2.0 commits, each such sequence listed apart from then on", () => {
	const GESTURES = [
		{ name: "pending", engaged: false, button: null },
		{ name: "move", engaged: true, button: null },
		{ name: "chain", engaged: true, button: 0 },
		{ name: "pan", engaged: true, button: 1 },
	];
	const declaration = { threshold: 4, gestures: GESTURES };
	const rnd = seededRandom();
	const { int, pick, chance } = randomTools(rnd);
	let compared = 0, apart = 0, buttonIdentity = 0;
	for (let n = 0; n < 600; n++) {
		const old = released.openGestureSession(declaration).session;
		const fresh = current.openGestureSession(declaration).session;
		for (let k = int(5, 40); k > 0; k--) {
			const op = randomOperation({ int, pick, chance }, GESTURES);
			const [oldBefore, freshBefore] = [old.state, fresh.state];
			const run = (session) => {
				try {
					return { outcome: applyToSession(session, op) };
				} catch (error) {
					return { refused: error.constructor.name };
				}
			};
			const [a, b] = [run(old), run(fresh)];
			assert.equal(b.refused, a.refused, describe(op));
			if (a.refused !== undefined) {
				assert.equal(fresh.state, freshBefore);
				continue;
			}
			const [pa, pb] = [project(a.outcome), project(b.outcome)];
			const g = freshBefore.gesture === null ? null : GESTURES.find((x) => x.name === freshBefore.gesture.name).button;
			const chord = op.kind === "up" && g !== null && g !== op.button && freshBefore.press !== null && freshBefore.press.button === g;
			if (chord) {
				assert.deepEqual([pa.phase, pb.phase], [null, "commit"], `a chord's release: 0.1.0 leaves the gesture live, 0.2.0 commits it -- ${describe(op)}`);
				apart++;
				break;
			}
			assert.deepEqual(pb, pa, describe(op));
			// a press that differs from the held press in its button alone is a new press under 0.2.0, the very same under 0.1.0
			const buttonAlone = op.kind === "down" && freshBefore.press !== null && freshBefore.press.button !== op.button + 0 && a.outcome.state.press === oldBefore.press;
			if (buttonAlone) {
				assert.deepEqual(identities(freshBefore, b.outcome), [false, false, true]);
				buttonIdentity++;
			} else assert.deepEqual(identities(freshBefore, b.outcome), identities(oldBefore, a.outcome), describe(op));
			compared++;
		}
	}
	assert.ok(compared > 8000 && apart > 20 && buttonIdentity > 0, `${compared} compared, ${apart} chord sequences listed apart, ${buttonIdentity} presses new by their button alone`);
});

test("I19: every argument is read as 0.1.0 read it, a pointer operation's fact then read for its pointerId; and the reading stops where 0.1.0's stopped", () => {
	const declaration = { threshold: 4, gestures: [{ name: "move", engaged: true, button: null }, { name: "chain", engaged: true, button: 0 }] };
	const calls = [
		["pointerDown", (log) => [recorded({ at: recorded({ x: 1, y: 2 }, "at", log), button: 0, key: "k" }, "fact", log)], true],
		["pointerMove", (log) => [recorded({ at: recorded({ x: 1, y: 2 }, "at", log), button: 0 }, "fact", log)], true],
		["pointerUp", (log) => [recorded({ at: { x: 0, y: 0 }, button: 0 }, "fact", log)], true],
		["pressMatched", (log) => [recorded({ id: "r", opens: null, owner: "o", row: {} }, "match", log)], false],
		["startGesture", (log) => [recorded({ gesture: "move", row: "r", from: recorded({ x: 1, y: 1 }, "from", log) }, "args", log)], false],
		["becomeGesture", (log) => [recorded({ gesture: "chain", from: recorded({ x: 1, y: 1 }, "from", log) }, "args", log)], false],
		["pointerLost", (log) => [recorded({}, "fact", log)], false],
		["cancelGesture", (log) => [recorded({}, "fact", log)], false],
		["pointerDown", (log) => [recorded({ at: recorded({ x: NaN, y: 2 }, "at", log), button: 0 }, "fact", log)], false],
		["pointerDown", (log) => [recorded({ at: { x: 0, y: 0 }, button: "0" }, "fact", log)], false],
		["pointerUp", (log) => [recorded({ button: 1.5 }, "fact", log)], false],
		["pressMatched", (log) => [recorded({ id: "", opens: null }, "match", log)], false],
	];
	for (const [fn, args, readsPointerId] of calls) {
		const logs = [];
		for (const module of [released, current]) {
			const s = module.openGestureSession(declaration).session;
			s.pointerDown({ at: { x: 0, y: 0 }, button: 1 });
			if (fn === "becomeGesture") s.startGesture({ gesture: "move" });
			const log = [];
			try {
				s[fn](...args(log));
			} catch {
				// a malformed argument: the reads made before the refusal are compared
			}
			logs.push(log);
		}
		assert.deepEqual(logs[1], readsPointerId ? [...logs[0], "fact getOwnPropertyDescriptor pointerId"] : logs[0], fn);
	}
});

test("I19: the changes listed beside 0.1.0 -- a pointerId of no form refused where 0.1.0 passed it unread; another pointer's release, which 0.1.0 let end the press", () => {
	const declaration = { threshold: 4, gestures: [{ name: "g0", engaged: true, button: 0 }] };
	for (const pointerId of ["7", 1.5, undefined]) {
		const fact = { at: { x: 0, y: 0 }, button: 0, pointerId };
		assert.doesNotThrow(() => released.openGestureSession(declaration).session.pointerDown(fact));
		assert.throws(() => current.openGestureSession(declaration).session.pointerDown(fact), (e) => e instanceof TypeError && e.message.startsWith("pointerDown:"));
	}
	const sequence = (s) => {
		s.pointerDown({ at: { x: 0, y: 0 }, button: 0, pointerId: 7 });
		s.pressMatched({ id: "r", opens: "g0" });
		return s.pointerUp({ button: 2, pointerId: 1 });
	};
	const old = released.openGestureSession(declaration).session;
	const fresh = current.openGestureSession(declaration).session;
	assert.deepEqual([sequence(old).phase, old.state.press], [null, null], "0.1.0: the press ended, the gesture left live");
	const outcome = sequence(fresh);
	assert.deepEqual([outcome.phase, outcome.otherPointer, fresh.state.press.pointer], [null, true, 7], "0.2.0: nothing changed");
});
