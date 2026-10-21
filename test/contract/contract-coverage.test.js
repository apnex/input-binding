// contract-coverage - one test file per row of CONTRACT.md's capability table, so the contract reads as a
// list of tests (the design's section 4: "one file per capability").
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { contractRows } from "../../tools/check-export-map.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const rows = contractRows(fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8"));

test("CONTRACT.md has its seven capabilities", () => {
	assert.deepEqual(rows, ["declared-binding-table", "one-binding-match", "binding-match-trace", "binding-overlaps", "declared-gesture-session", "press-travel", "live-gesture"]);
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

test("CONTRACT.md states every rule, IB1 to IB13, and every invariant, I1 to I14", () => {
	const text = fs.readFileSync(path.join(here, "..", "..", "CONTRACT.md"), "utf8");
	for (let n = 1; n <= 13; n++) assert.match(text, new RegExp(`\\*\\*IB${n} -- `), `IB${n}`);
	for (let n = 1; n <= 14; n++) assert.match(text, new RegExp(`^\\| I${n} \\|`, "m"), `I${n}`);
});
