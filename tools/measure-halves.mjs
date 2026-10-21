#!/usr/bin/env node
// measure-halves - the built size of each half (the design's section 7 and D11): the table's code, the
// session's code -- the exact distance among it -- and the code both share, from dist/ as built.
//
// One export path, and no dynamic import, load both halves wherever either is imported; this measures
// what that costs. Each built file is counted as shipped, comments included, and again with its comments
// removed (TypeScript's transpiler, removeComments), and gzipped at level 9 both ways.
//
// Usage:  node tools/measure-halves.mjs    (after npm run build)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
export const HALVES = {
	table: ["binding-declaration.js", "binding-table.js"],
	session: ["session-declaration.js", "gesture-session.js", "travel-beyond.js"],
	shared: ["reflection.js", "argument-reading.js", "declaration-problems.js", "index.js", "types.js"],
};

const stripped = (source) => ts.transpileModule(source, { compilerOptions: { removeComments: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/\n\/\/# sourceMappingURL=.*$/m, "");

/** Bytes of one built file: as shipped and without comments, each raw and gzipped. */
export function measure(file) {
	const source = fs.readFileSync(path.join(dist, file), "utf8");
	const bare = stripped(source);
	return { file, bytes: Buffer.byteLength(source), gzip: gzipSync(source, { level: 9 }).length, bare: Buffer.byteLength(bare), bareGzip: gzipSync(bare, { level: 9 }).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const listed = new Set(Object.values(HALVES).flat());
	const built = fs.readdirSync(dist).filter((f) => f.endsWith(".js"));
	const missed = built.filter((f) => !listed.has(f));
	if (missed.length) {
		console.log(`measure-halves: FAIL -- built files in no half: ${missed.join(", ")}`);
		process.exit(1);
	}
	console.log("half      file                      bytes   gzip   no comments   gzip");
	for (const [half, files] of Object.entries(HALVES)) {
		const rows = files.map(measure);
		for (const r of rows) console.log(`${half.padEnd(9)} ${r.file.padEnd(24)} ${String(r.bytes).padStart(6)} ${String(r.gzip).padStart(6)} ${String(r.bare).padStart(13)} ${String(r.bareGzip).padStart(6)}`);
		const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
		console.log(`${half.padEnd(9)} ${"(total)".padEnd(24)} ${String(sum("bytes")).padStart(6)} ${String(sum("gzip")).padStart(6)} ${String(sum("bare")).padStart(13)} ${String(sum("bareGzip")).padStart(6)}`);
	}
}
