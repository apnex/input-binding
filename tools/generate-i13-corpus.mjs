#!/usr/bin/env node
// generate-i13-corpus - write I13's corpus (CONTRACT.md I13; the design's section 4 and guardrail G4):
// draw's matcher and press at commit 5b4997b, run over generated tables and streams, and stated as data
// with no word of draw's.
//
// It is run once, against draw's repository, and its output is committed; the corpus test then holds
// input-binding to it. The three files are taken from the commit itself with `git archive`, never from
// a working tree, into a scratch directory of their own, and imported there:
// - kernel/input-rules.mjs -- composeRules, resolveInput and overlapsIn;
// - app/src/input-state.js -- the press: initialInputState and track;
// - app/src/triggers.js -- DRAG_THRESHOLD, dragging and releaseTrigger.
//
// What the corpus holds, every answer draw's own code gave:
// - `admission`: draw's guard rule, over every combination of its four row flags and three guard states,
//   each true, false or omitted, and the guard state itself omitted -- one row, `on` always true, so the
//   row matches exactly when it is admitted;
// - `tables`: generated tables of tenants and rows, each row's `on` and `when` stated as data -- the
//   fields of a fact or a context it requires equal, and the kind of value it answers, so truthiness
//   is exercised -- with facts, contexts and guard states, and for every combination draw's match and
//   claim, and draw's overlaps over the same lists;
// - `refusals`: tables in which an id is taken twice, with the id and both owners draw's error names;
// - `streams` and `apart`: streams of presses, moves, releases, lost pointers and restarts, with draw's
//   answer after each step -- whether the press is a drag, or what the release is. Every answer is also
//   computed exactly, by test/support/travel-oracle.js, which shares no code with input-binding; a stream
//   on which the two agree is in `streams`, and one on which they differ is in `apart`, with both
//   answer lists and every press point where draw's Math.hypot decision differs from the exact one.
//
// Draw's names never reach the output: its four guard flags are f0 to f3, its three states s0 to s2,
// its claim flag c0 and its gesture field o, and the guards are stated in input-binding's own form
// (the design's section 5), which `admission` then holds to draw's rule.
//
// Its random choices are seeded, so a second run writes the same bytes.
//
// Usage:  node tools/generate-i13-corpus.mjs <draw repository> [output]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { nextDown, nextUp, randomTools, seededRandom } from "../test/support/doubles.js";
import { oracleBeyond, oracleCompare } from "../test/support/travel-oracle.js";

const COMMIT = "5b4997b";
const SEED = 20261021;
const FILES = { matcher: "kernel/input-rules.mjs", press: "app/src/input-state.js", trigger: "app/src/triggers.js" };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [drawRepository, output = path.join(root, "test", "corpus", "i13-corpus.json")] = process.argv.slice(2);
if (!drawRepository) {
	console.error("usage: node tools/generate-i13-corpus.mjs <draw repository> [output]");
	process.exit(2);
}
const git = (...args) => execFileSync("git", ["-C", drawRepository, ...args], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "--verify", `${COMMIT}^{commit}`);
const blobs = Object.fromEntries(Object.entries(FILES).map(([role, file]) => [role, git("rev-parse", `${commit}:${file}`)]));

// The three files at the commit, from git's object store, into a scratch directory of their own
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "input-binding-i13-"));
let matcher, press, trigger;
try {
	const archive = execFileSync("git", ["-C", drawRepository, "archive", "--format=tar", commit, ...Object.values(FILES)]);
	execFileSync("tar", ["-x", "-C", scratch], { input: archive });
	fs.writeFileSync(path.join(scratch, "package.json"), JSON.stringify({ type: "module" }));
	const load = (file) => import(pathToFileURL(path.join(scratch, file)).href);
	[matcher, press, trigger] = await Promise.all(Object.values(FILES).map(load));
} finally {
	fs.rmSync(scratch, { recursive: true, force: true });
}
const { composeRules, resolveInput, overlapsIn } = matcher;
const { initialInputState, track } = press;
const { DRAG_THRESHOLD, dragging, releaseTrigger } = trigger;
for (const [name, f] of Object.entries({ composeRules, resolveInput, overlapsIn, initialInputState, track, dragging, releaseTrigger })) {
	if (typeof f !== "function") throw new Error(`generate-i13-corpus: draw's ${name} is not a function at ${COMMIT}`);
}
if (DRAG_THRESHOLD !== 4) throw new Error(`generate-i13-corpus: draw's threshold is ${DRAG_THRESHOLD}, not 4`);

const rnd = seededRandom(SEED);
const { int, pick, chance, shuffle } = randomTools(rnd);

// ---- names: draw's flags and states, and input-binding's neutral names for them
const FLAG_OF = { f0: "mutates", f1: "whileReadOnly", f2: "duringHelp", f3: "duringGesture" };
const STATE_OF = { s0: "readOnly", s1: "helpOpen", s2: "gesturing" };
const CLAIM_FLAG = "c0";
const OPENS_FIELD = "o";
// draw's four guards and its claim, in input-binding's form (the design's section 5)
const GUARDS = [
	{ state: "s0", flag: "f0", default: true, refuses: "state-and-flag" },
	{ state: "s0", flag: "f1", default: false, refuses: "flag-without-state" },
	{ state: "s1", flag: "f2", default: false, refuses: "state-without-flag" },
	{ state: "s2", flag: "f3", default: false, refuses: "state-without-flag" },
];
const CLAIM = { flag: CLAIM_FLAG, default: true };
const OPENS = { field: OPENS_FIELD };

/** A guard state in draw's names, or undefined for an omitted one. */
const drawGuards = (states) => (states === null ? undefined : Object.fromEntries(Object.entries(states).map(([s, v]) => [STATE_OF[s], v])));

/** What a predicate stated as data answers, in the kind of value it names. */
const ANSWERS = { boolean: [true, false], number: [1, 0], string: ["y", ""], object: [{}, null] };

/** A predicate from its statement: every listed field of its argument equal, answered in the named kind. */
function predicateOf(fields, kind) {
	const [yes, no] = ANSWERS[kind];
	const entries = Object.entries(fields);
	return (argument) => (entries.every(([k, v]) => argument[k] === v) ? yes : no);
}

/** A row stated as data, made into draw's row: its predicates, and its flags under draw's names. */
function drawRow(spec) {
	const row = { id: spec.id, on: predicateOf(spec.on, spec.onAs) };
	if (spec.when) row.when = predicateOf(spec.when, spec.whenAs);
	for (const [flag, name] of Object.entries(FLAG_OF)) if (flag in spec) row[name] = spec[flag];
	if (CLAIM_FLAG in spec) row.prevent = spec[CLAIM_FLAG];
	if (OPENS_FIELD in spec) row.gesture = spec[OPENS_FIELD];
	return row;
}

const drawTable = (tenants) => composeRules(...tenants.map((t) => ({ owner: t.owner, rules: t.rows.map(drawRow) })));

// ---- admission: draw's guard rule over every flag and state, each true, false or omitted
const THREE = [true, false, undefined];
const admission = [];
const flagCombos = [];
for (const a of THREE) for (const b of THREE) for (const c of THREE) for (const d of THREE) {
	const flags = {};
	[a, b, c, d].forEach((v, i) => {
		if (v !== undefined) flags[`f${i}`] = v;
	});
	flagCombos.push(flags);
}
const stateCombos = [null];
for (const a of THREE) for (const b of THREE) for (const c of THREE) {
	const states = {};
	[a, b, c].forEach((v, i) => {
		if (v !== undefined) states[`s${i}`] = v;
	});
	stateCombos.push(states);
}
for (const states of stateCombos) {
	for (const flags of flagCombos) {
		const table = drawTable([{ owner: "t0", rows: [{ id: "r0", on: {}, onAs: "boolean", ...flags }] }]);
		const answer = resolveInput(table, {}, {}, drawGuards(states));
		admission.push({ flags, states, admitted: answer.rule !== null });
	}
}

// ---- tables: generated tenants and rows, every combination of their facts, contexts and guard states
const FACT_FIELDS = { k: [0, 1, 2, 3], m: [0, 1] };
const CONTEXT_FIELDS = { v: [0, 1, 2], w: [0, 1] };
const KINDS = Object.keys(ANSWERS);

function statement(fields, maxFields) {
	const out = {};
	for (const key of shuffle(Object.keys(fields)).slice(0, int(0, maxFields))) out[key] = pick(fields[key]);
	return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}

function randomRow(id) {
	const row = { id, on: statement(FACT_FIELDS, 2), onAs: chance(0.6) ? "boolean" : pick(KINDS) };
	if (Object.keys(row.on).length === 0 && chance(0.7)) row.on = { k: pick(FACT_FIELDS.k) };
	if (chance(0.6)) {
		row.when = statement(CONTEXT_FIELDS, 2);
		row.whenAs = chance(0.6) ? "boolean" : pick(KINDS);
	}
	for (const flag of ["f0", "f1", "f2", "f3"]) if (chance(0.35)) row[flag] = chance(0.5);
	if (chance(0.4)) row[CLAIM_FLAG] = chance(0.5);
	if (chance(0.3)) row[OPENS_FIELD] = `g${int(0, 2)}`;
	return row;
}

function randomTenants(rowCount, ids) {
	const tenantCount = int(1, 3);
	const tenants = Array.from({ length: tenantCount }, (_, i) => ({ owner: `t${i}`, rows: [] }));
	for (let r = 0; r < rowCount; r++) pick(tenants).rows.push(randomRow(ids(r)));
	return tenants;
}

const everyValue = (fields) => {
	let combos = [{}];
	for (const [key, values] of Object.entries(fields)) combos = combos.flatMap((c) => values.map((v) => ({ ...c, [key]: v })));
	return combos;
};

const tables = [];
for (let n = 0; n < 40; n++) {
	const tenants = randomTenants(int(2, 10), (r) => `r${r}`);
	const facts = shuffle(everyValue(FACT_FIELDS)).slice(0, int(3, 6));
	const contexts = shuffle(everyValue(CONTEXT_FIELDS)).slice(0, int(2, 4));
	const guardStates = shuffle(stateCombos.slice(1)).slice(0, int(3, 5));
	const table = drawTable(tenants);
	const answers = [];
	for (const g of [null, ...guardStates.keys()]) {
		for (const [c, context] of contexts.entries()) {
			for (const [f, fact] of facts.entries()) {
				const answer = resolveInput(table, fact, context, drawGuards(g === null ? null : guardStates[g]));
				answers.push([g, c, f, answer.rule === null ? null : answer.rule.id, answer.claimed]);
			}
		}
	}
	const drawStates = guardStates.map((s) => drawGuards(s));
	const found = overlapsIn(table, facts, contexts, drawStates);
	const overlaps = found.map((o) => [drawStates.indexOf(o.guards), contexts.indexOf(o.situation), facts.indexOf(o.input), o.ids]);
	tables.push({ tenants, facts, contexts, guardStates, answers, overlaps });
}

// ---- refusals: an id taken twice
const refusals = [];
for (let n = 0; n < 12; n++) {
	const tenants = randomTenants(int(3, 8), (r) => `r${r}`);
	const rows = tenants.flatMap((t) => t.rows);
	const taken = pick(rows.slice(0, -1));
	const later = pick(rows.slice(rows.indexOf(taken) + 1));
	later.id = taken.id;
	let thrown = null;
	try {
		drawTable(tenants);
	} catch (e) {
		thrown = e.message;
	}
	const match = /^input rule '([^']*)' is brought by both (\S+) and (\S+) -- an id names one row$/.exec(thrown ?? "");
	if (match === null) throw new Error(`generate-i13-corpus: draw did not refuse a duplicate id as expected: ${thrown}`);
	refusals.push({ tenants, duplicate: { id: match[1], owners: [match[2], match[3]] } });
}

// ---- streams of presses and moves
const THRESHOLD = DRAG_THRESHOLD;

/** Draw's answers over a stream: after each step, whether the press is a drag; for a release, what it is. */
function drawAnswers(steps) {
	let state = initialInputState();
	return steps.map(([op, x, y]) => {
		if (op === "up") {
			const answer = releaseTrigger(state);
			state = track(state, { type: "up" });
			return answer;
		}
		const type = { down: "down", move: "move", lost: "cancel", restart: "chained" }[op];
		state = track(state, op === "lost" ? { type } : { type, at: { x, y } });
		return dragging(state);
	});
}

/** The exact answers over a stream, the press decided by the oracle; and every move whose Math.hypot decision differs from the exact one. */
function exactAnswers(steps) {
	let held = null;
	const points = [];
	const answers = steps.map(([op, x, y], step) => {
		if (op === "down") held = { x, y, beyond: false };
		else if (op === "restart") held = held && { x, y, beyond: false };
		else if (op === "lost") held = null;
		else if (op === "up") {
			const answer = held !== null && held.beyond ? "drop" : "click";
			held = null;
			return answer;
		} else if (op === "move" && held !== null) {
			const exact = oracleBeyond(held.x, held.y, x, y, THRESHOLD);
			const hypot = Math.hypot(x - held.x, y - held.y);
			if (hypot > THRESHOLD !== exact) points.push({ step, from: [held.x, held.y], to: [x, y], hypot, exactSign: oracleCompare(held.x, held.y, x, y, THRESHOLD), wasBeyond: held.beyond });
			if (exact) held = { ...held, beyond: true };
		}
		return held !== null && held.beyond;
	});
	return { answers, points };
}

const DRAWING = { x: 960, y: 540 };
const fraction = () => Math.round((rnd() * 2 - 1) * 2 ** 40) / 2 ** int(0, 40);
const randomOrigin = () => [(rnd() * 2 - 1) * DRAWING.x, (rnd() * 2 - 1) * DRAWING.y];
const PYTHAGOREAN = [[0, 4], [4, 0], [0, -4], [-4, 0], [2.4, 3.2], [-3.2, 2.4], [0.8 * 3, 0.8 * 4], [4 * 0.6, -4 * 0.8]];

/** A move aimed at a press origin: on, inside and beyond the threshold, on a quarter lattice, near it by a step, far, or extreme. */
function aimedMove([x0, y0]) {
	const choice = int(0, 9);
	if (choice === 0) {
		const [dx, dy] = pick(PYTHAGOREAN);
		return [x0 + dx, y0 + dy];
	}
	if (choice === 1) return [x0 + pick([nextUp, nextDown])(4), y0];
	if (choice === 2) return [x0 + int(-32, 32) / 4, y0 + int(-32, 32) / 4];
	if (choice === 3) {
		const theta = rnd() * 2 * Math.PI, r = 4 + (rnd() - 0.5) * 2 ** -int(10, 50);
		return [x0 + r * Math.cos(theta), y0 + r * Math.sin(theta)];
	}
	if (choice === 4) return [x0 + (rnd() * 2 - 1) * 3, y0 + (rnd() * 2 - 1) * 3];
	if (choice === 5) return [x0 + fraction(), y0 + fraction()];
	if (choice === 6) return [pick([1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE, 1e-300, Number.MIN_VALUE, 0]), pick([0, 1e-310, -Number.MAX_VALUE])];
	if (choice === 7) return [x0, y0];
	if (choice === 8) return [x0 + 4, y0 + pick([0, Number.MIN_VALUE, 2 ** -60, -(2 ** -60)])];
	return randomOrigin();
}

/** An origin: across the drawing, on integers, or extreme. */
function randomPressPoint() {
	const choice = int(0, 9);
	if (choice < 6) return randomOrigin();
	if (choice < 8) return [int(-960, 960), int(-540, 540)];
	if (choice < 9) return [pick([1e300, -1e300, Number.MAX_VALUE, -Number.MAX_VALUE]), pick([0, 1e300])];
	return [pick([1e-300, Number.MIN_VALUE, -Number.MIN_VALUE, 0]), pick([0, Number.MIN_VALUE])];
}

/** A stream of the general family: presses, moves, releases, lost pointers, restarts and second presses, in any order. */
function generalStream() {
	const steps = [];
	let origin = null;
	for (let n = int(3, 14); n > 0; n--) {
		const choice = int(0, 19);
		if (origin === null || choice < 3) {
			origin = randomPressPoint();
			steps.push(["down", ...origin]);
		} else if (choice < 13) steps.push(["move", ...aimedMove(origin)]);
		else if (choice < 16) {
			steps.push(["up"]);
			if (chance(0.7)) origin = null;
		} else if (choice < 17) {
			steps.push(["lost"]);
			if (chance(0.7)) origin = null;
		} else {
			origin = chance(0.5) ? randomOrigin() : aimedMove(origin);
			steps.push(["restart", ...origin]);
		}
	}
	if (chance(0.8)) steps.push(["up"]);
	return steps;
}

/**
 * A stream of the edge family: a press across the drawing, one or two moves whose travel lies within
 * about 3 x 10^-15 of the threshold, and a release. Adding a travel to an origin of hundreds of units
 * rounds by about 10^-13, so each move is drawn again until its travel, as Math.hypot measures it from
 * the rounded point, lands within that band.
 */
function edgeStream() {
	const origin = randomOrigin();
	const steps = [["down", ...origin]];
	for (let n = int(1, 2); n > 0; n--) {
		let move;
		do {
			const theta = rnd() * 2 * Math.PI, r = THRESHOLD + (rnd() - 0.5) * 4e-15;
			move = [origin[0] + r * Math.cos(theta), origin[1] + r * Math.sin(theta)];
		} while (Math.abs(Math.hypot(move[0] - origin[0], move[1] - origin[1]) - THRESHOLD) > 3e-15);
		steps.push(["move", ...move]);
	}
	steps.push(["up"]);
	return steps;
}

const streams = [];
const apart = [];
const generated = [...Array.from({ length: 400 }, () => ["general", generalStream()]), ...Array.from({ length: 2000 }, () => ["edge", edgeStream()])];
for (const [family, steps] of generated) {
	const reference = drawAnswers(steps);
	const { answers: exact, points } = exactAnswers(steps);
	const same = reference.every((a, i) => a === exact[i]);
	if (same) {
		streams.push({ family, steps, answers: reference });
		continue;
	}
	const listed = points.filter((p) => reference[p.step] !== exact[p.step]).map(({ wasBeyond, ...p }) => ({
		...p,
		reference: reference[p.step],
		exact: exact[p.step],
		reason: p.exactSign <= 0 ? "Math.hypot of the rounded differences lies above the threshold, where the exact distance is at most it" : "Math.hypot of the rounded differences lies at or below the threshold, where the exact distance exceeds it",
	}));
	if (listed.length === 0) throw new Error(`generate-i13-corpus: a stream differs with no press point to list: ${JSON.stringify(steps)}`);
	apart.push({ family, steps, reference, exact, points: listed });
}

// ---- the corpus, one entry per line
const corpus = {
	about: "I13: the matcher and the press of input-binding's first consumer, at one commit, stated as data with no word of that consumer's. Generated by tools/generate-i13-corpus.mjs; never written by hand.",
	commit,
	blobs,
	seed: SEED,
	guards: GUARDS,
	claim: CLAIM,
	opens: OPENS,
	answerKinds: ANSWERS,
	threshold: THRESHOLD,
	admission,
	tables,
	refusals,
	streams,
	apart,
};

const line = (value) => JSON.stringify(value);
const out = ["{"];
const keys = Object.keys(corpus);
keys.forEach((key, i) => {
	const value = corpus[key];
	const comma = i < keys.length - 1 ? "," : "";
	if (key === "tables") {
		out.push(`  ${line(key)}: [`);
		value.forEach((t, j) => {
			out.push("    {");
			out.push(`      "tenants": ${line(t.tenants)},`);
			out.push(`      "facts": ${line(t.facts)},`);
			out.push(`      "contexts": ${line(t.contexts)},`);
			out.push(`      "guardStates": ${line(t.guardStates)},`);
			out.push(`      "answers": [`);
			t.answers.forEach((a, k) => out.push(`        ${line(a)}${k < t.answers.length - 1 ? "," : ""}`));
			out.push("      ],");
			out.push(`      "overlaps": [`);
			t.overlaps.forEach((o, k) => out.push(`        ${line(o)}${k < t.overlaps.length - 1 ? "," : ""}`));
			out.push("      ]");
			out.push(`    }${j < value.length - 1 ? "," : ""}`);
		});
		out.push(`  ]${comma}`);
	} else if (Array.isArray(value) && ["admission", "refusals", "streams", "apart"].includes(key)) {
		out.push(`  ${line(key)}: [`);
		value.forEach((v, j) => out.push(`    ${line(v)}${j < value.length - 1 ? "," : ""}`));
		out.push(`  ]${comma}`);
	} else out.push(`  ${line(key)}: ${line(value)}${comma}`);
});
out.push("}");
const text = `${out.join("\n")}\n`;
JSON.parse(text);
fs.writeFileSync(output, text);
const pointCount = apart.reduce((n, s) => n + s.points.length, 0);
console.log(`generate-i13-corpus: wrote ${path.relative(process.cwd(), output)} from draw at ${commit.slice(0, 7)}: ${admission.length} admission cases, ${tables.length} tables (${tables.reduce((n, t) => n + t.answers.length, 0)} answers, ${tables.reduce((n, t) => n + t.overlaps.length, 0)} overlaps), ${refusals.length} refusals, ${streams.length} streams agreeing, ${apart.length} apart with ${pointCount} press point(s)`);
