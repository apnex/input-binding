// i13-corpus - I13: the table and the press reproduce a reference matcher and press, answer for answer,
// except at the press points the corpus lists apart, where the session gives the exact answer instead.
//
// The corpus was generated once from the reference at a fixed commit (test/corpus/README.md says how)
// and is never written by hand. Its tables are data -- each predicate the fields it requires equal and
// the kind of value it answers -- which this test turns into predicates. It names no word of the
// reference's vocabulary, which the vocabulary check confirms here, with the reference's own list.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { composeBindingTable, openGestureSession } from "@apnex/input-binding";
import { findVocabulary, readVocabulary } from "../../tools/check-vocabulary.mjs";
import { oracleBeyond } from "../support/travel-oracle.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const text = fs.readFileSync(path.join(here, "i13-corpus.json"), "utf8");
const corpus = JSON.parse(text);

/** A predicate from its statement: every listed field of its argument equal, answered in the named kind. */
function predicateOf(fields, kind) {
	const [yes, no] = corpus.answerKinds[kind];
	const entries = Object.entries(fields);
	return (argument) => (entries.every(([k, v]) => argument[k] === v) ? yes : no);
}

/** A row stated as data, made into a row: its predicates, its flags and its opens field as they are stated. */
function rowOf(spec) {
	const row = { ...spec, on: predicateOf(spec.on, spec.onAs) };
	delete row.onAs;
	delete row.whenAs;
	if (spec.when) row.when = predicateOf(spec.when, spec.whenAs);
	return row;
}

const declarationOf = (tenants) => ({ guards: corpus.guards, claim: corpus.claim, opens: corpus.opens, tenants: tenants.map((t) => ({ owner: t.owner, rows: t.rows.map(rowOf) })) });

test("the corpus is the reference's at its commit, of every part, and names no word of the reference's vocabulary", () => {
	assert.match(corpus.commit, /^5b4997b[0-9a-f]{33}$/);
	assert.deepEqual(Object.keys(corpus.blobs), ["matcher", "press", "trigger"]);
	assert.equal(corpus.threshold, 4);
	assert.equal(corpus.admission.length, 81 * 28);
	assert.ok(corpus.tables.length >= 40 && corpus.refusals.length >= 10);
	assert.ok(corpus.streams.length > 2000 && corpus.apart.length > 0);
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary(text, { reference: lists.draw }), [], "no word of the reference's list");
	for (const word of ["readOnly", "helpOpen", "gesturing", "mutates", "whileReadOnly", "duringHelp", "duringGesture", "prevent", "situation", "canvas"]) assert.ok(!text.includes(word), `the corpus holds no "${word}"`);
});

test("I13, I3: the four guards admit exactly what the reference admits, every flag and state true, false or omitted, and the guard state itself omitted", () => {
	for (const { flags, states, admitted } of corpus.admission) {
		const composed = composeBindingTable(declarationOf([{ owner: "t0", rows: [{ id: "r0", on: {}, onAs: "boolean", ...flags }] }]));
		assert.equal(composed.ok, true);
		const answer = states === null ? composed.table.matchInput({}, {}) : composed.table.matchInput({}, {}, states);
		assert.equal(answer.match !== null, admitted, JSON.stringify({ flags, states }));
	}
});

test("I13: every table's match and claim, for every fact, context and guard state, are the reference's, and so are its overlaps", () => {
	let matched = 0, unmatched = 0, overlaps = 0;
	for (const [n, t] of corpus.tables.entries()) {
		const composed = composeBindingTable(declarationOf(t.tenants));
		assert.equal(composed.ok, true, `table ${n}`);
		const { table } = composed;
		const specs = t.tenants.flatMap((tenant) => tenant.rows);
		assert.deepEqual(table.rows.map((e) => e.opens), specs.map((s) => s.o ?? null), `table ${n}'s opens`);
		for (const [g, c, f, id, claimed] of t.answers) {
			const answer = g === null ? table.matchInput(t.facts[f], t.contexts[c]) : table.matchInput(t.facts[f], t.contexts[c], t.guardStates[g]);
			assert.deepEqual([answer.match?.id ?? null, answer.claimed], [id, claimed], `table ${n}, guard state ${g}, context ${c}, fact ${f}`);
			id === null ? unmatched++ : matched++;
		}
		const found = table.findOverlaps(t.facts, t.contexts, t.guardStates);
		assert.deepEqual(found.map((o) => [t.guardStates.indexOf(o.guards), t.contexts.indexOf(o.context), t.facts.indexOf(o.fact), [...o.ids]]), t.overlaps, `table ${n}'s overlaps`);
		overlaps += found.length;
	}
	assert.ok(matched > 300 && unmatched > 300 && overlaps > 50, `${matched} matched, ${unmatched} unmatched, ${overlaps} overlaps`);
});

test("I13: a table in which an id is taken twice is refused, its first duplicate the id and the owners the reference named", () => {
	for (const { tenants, duplicate } of corpus.refusals) {
		const result = composeBindingTable(declarationOf(tenants));
		assert.equal(result.ok, false);
		assert.ok(result.problems.every((p) => p.problem === "duplicate-id"), JSON.stringify(result.problems));
		const at = (pointer) => {
			const [, i, j] = /^\/tenants\/(\d+)\/rows\/(\d+)\/id$/.exec(pointer);
			return { owner: tenants[i].owner, id: tenants[i].rows[j].id, order: tenants.slice(0, i).reduce((k, x) => k + x.rows.length, 0) + Number(j) };
		};
		const first = result.problems.map((p) => at(p.pointer)).sort((a, b) => a.order - b.order)[0];
		assert.equal(first.id, duplicate.id);
		assert.equal(first.owner, duplicate.owners[1]);
		const earlier = tenants.flatMap((x) => x.rows.map((r) => ({ owner: x.owner, id: r.id }))).find((r) => r.id === duplicate.id);
		assert.equal(earlier.owner, duplicate.owners[0]);
	}
});

/** A session's answers over a stream: after each step, whether the press is beyond; for a release, its trigger. */
function sessionAnswers(steps, onStep = () => {}) {
	const { session } = openGestureSession({ threshold: corpus.threshold, gestures: [{ name: "g", engaged: true, button: null }] });
	return steps.map(([op, x, y], step) => {
		onStep(step, session.state);
		if (op === "up") return session.pointerUp({ button: 0 }).trigger;
		if (op === "down") session.pointerDown({ at: { x, y }, button: 0 });
		else if (op === "move") session.pointerMove({ at: { x, y } });
		else if (op === "lost") session.pointerLost();
		else if (op === "restart") (session.state.gesture === null ? session.startGesture : session.becomeGesture)({ gesture: "g", from: { x, y } });
		else throw new Error(`no step ${op}`);
		return session.state.press !== null && session.state.press.beyond;
	});
}

test("I13: over every stream of presses and moves the corpus holds in agreement, the session answers as the reference does", () => {
	const families = { general: 0, edge: 0 };
	let drops = 0;
	for (const { family, steps, answers } of corpus.streams) {
		assert.deepEqual(sessionAnswers(steps), answers, JSON.stringify(steps));
		families[family]++;
		drops += answers.filter((a) => a === "drop").length;
	}
	assert.ok(families.general > 300 && families.edge > 1000 && drops > 500, JSON.stringify({ ...families, drops }));
});

test("I13: at the press points the corpus lists apart, within the exact band, the session gives the exact answer, not the reference's Math.hypot one", () => {
	let points = 0;
	for (const { steps, reference, exact, points: listed } of corpus.apart) {
		const origins = [];
		const answers = sessionAnswers(steps, (step, state) => (origins[step] = state.press === null ? null : [state.press.at.x, state.press.at.y]));
		assert.deepEqual(answers, exact, JSON.stringify(steps));
		assert.notDeepEqual(reference, exact);
		for (const p of listed) {
			points++;
			assert.equal(steps[p.step][0], "move");
			assert.deepEqual(steps[p.step].slice(1), p.to);
			assert.deepEqual(origins[p.step], p.from, "measured from the press the session held");
			assert.equal(p.reference, reference[p.step]);
			assert.equal(p.exact, exact[p.step]);
			assert.notEqual(p.reference, p.exact);
			assert.equal(oracleBeyond(...p.from, ...p.to, corpus.threshold), p.exactSign > 0);
			assert.equal(p.hypot > corpus.threshold, p.exactSign <= 0, "the reference's distance lies on the other side of the threshold");
			assert.ok(Math.abs(p.hypot - corpus.threshold) < 1e-14, `within the band: ${p.hypot}`);
			assert.equal(typeof p.reason, "string");
		}
		for (let i = 0; i < steps.length; i++) {
			if (reference[i] === exact[i]) continue;
			const cause = listed.some((p) => p.step <= i);
			assert.ok(cause, `an answer at step ${i} differs with no listed point at or before it`);
		}
	}
	assert.ok(points > 50, `${points} press points listed apart`);
});
