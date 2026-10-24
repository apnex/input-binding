// contract-coverage - one test file per row of CONTRACT.md's capability table, so the contract reads as a
// list of tests: one file per capability.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { contractRows } from "../../tools/check-export-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = contractRows(fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8"));

test("CONTRACT.md has its nine capabilities", () => {
	assert.deepEqual(rows, ["declared-binding-table", "one-binding-match", "binding-match-trace", "binding-overlaps", "declared-gesture-session", "press-travel", "live-gesture", "held-keys", "press-resolution"]);
});

for (const row of rows) {
	test(`${row} has its contract test file`, () => {
		assert.ok(fs.existsSync(path.join(here, `${row}.test.js`)), `test/contract/${row}.test.js is missing`);
	});
}

test("CONTRACT.md carries the six headings of a component entry, in order", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
	assert.deepEqual(headings, ["Duty", "Contract", "Reference", "Fit criteria", "Adjustment policy", "Edges"]);
	for (const field of ["id: unminted", "category: component", "status: draft", "sovereignty: internal", "supersedes: []", "related: [C0, A3]"]) {
		assert.ok(text.includes(`\n${field}\n`), `the frontmatter holds ${field}`);
	}
});

test("CONTRACT.md states every rule, IB1 to IB15, and every invariant, I1 to I19", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	for (let n = 1; n <= 15; n++) assert.match(text, new RegExp(`\\*\\*IB${n} -- `), `IB${n}`);
	for (let n = 1; n <= 19; n++) assert.match(text, new RegExp(`^\\| I${n} \\|`, "m"), `I${n}`);
});

test("CONTRACT.md names no draw file and cites no design or ruling of draw's but its one provenance line in Reference", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	const lines = text.split("\n");
	const provenance = lines.filter((line) => line.includes("apnex/drawv2"));
	assert.deepEqual(provenance, ["The design of record and the rulings that shape this component are kept in draw's records, `apnex/drawv2`."]);
	assert.ok(lines.indexOf(provenance[0]) > lines.indexOf("## Reference") && lines.indexOf(provenance[0]) < lines.indexOf("## Fit criteria"), "the line is under Reference");
	for (const pattern of [/draw's [`a-z]/, /\bthe design's\b/, /\bH26[-.]\d/, /\b[A-Z-]+\.md\b(?<!CONTRACT\.md|README\.md|VISION\.md|DECISIONS\.md)/, /\bB\d{3}\b/, /(app|kernel|server|plugins|lab|tools\/probe)\/[a-z-]+\.m?js/, /5b4997b/]) {
		const found = lines.filter((line) => pattern.test(line) && !provenance.includes(line));
		assert.deepEqual(found, [], `no line holds ${pattern}`);
	}
});
