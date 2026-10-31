// gate-checks - the gate's own checks (I14, IB13) can fail: the vocabulary check, its list for the tester
// named input-tester; the runtime check, its allow-list of the built-ins the build uses; the clock and chance
// check, with the forms input-capture refuses; and the release workflow's retried lookup of its draft
// (docs/DECISIONS.md, D3) -- each passes over this repository and fails over a copy holding what it exists to
// refuse.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { scratchFolder } from "@apnex/clean-runner";

import { candidateWords, findVocabulary, readVocabulary, splitWords } from "../../tools/check-vocabulary.mjs";
import { findClockAndChance } from "../../tools/check-clock-and-chance.mjs";
import { ALLOWED_GLOBALS, findRuntimeUses, freeGlobalReferences, parseModule } from "../../tools/check-runtime.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const run = (tool, ...args) => spawnSync(process.execPath, [path.join(root, "tools", tool), ...args], { encoding: "utf8" });
const scratch = (files) => {
	const dir = scratchFolder("input-binding-check-");
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
	return dir;
};

test("I14: the vocabulary check splits identifiers at case changes, underscores, hyphens and digits, and also compares each whole", () => {
	assert.deepEqual(splitWords("nodeCount NODE_EXT zone-keys HTMLLayout zone2 drawV2"), ["node", "count", "node", "ext", "zone", "keys", "html", "layout", "zone", "2", "draw", "v", "2"]);
	assert.deepEqual(candidateWords("draw_V2"), ["draw_v2", "drawv2", "draw", "v", "2"]);
	const lists = readVocabulary();
	assert.deepEqual(findVocabulary("// the anchor of a thing", lists).map((f) => f.word), ["anchor"]);
	assert.deepEqual(findVocabulary('const s = "Keyboard";', lists).map((f) => [f.word, f.consumer]), [["keyboard", "input-tester"]]);
	assert.deepEqual(findVocabulary("const route = group(key, mouse, bend, draw, nodal, linkage, keys, groups);", lists), [], "ordinary words, and words that merely contain a listed one, pass");
});

test("I14: plurals, digits and a case change inside a word are caught; a run of lower-case letters is not", () => {
	const lists = readVocabulary();
	const caught = (text) => findVocabulary(text, lists).map((f) => f.listed);
	assert.deepEqual(caught("const zones = [];"), ["zone"]);
	assert.deepEqual(caught("// nodes and glyphes"), ["node", "glyph"]);
	assert.deepEqual(caught("export const drawV2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("const draw_v2 = 1;"), ["drawv2"]);
	assert.deepEqual(caught("let zone2 = 0;"), ["zone"]);
	assert.deepEqual(caught("class ZoneGrid {}"), ["zone"]);
	assert.deepEqual(caught("const zonegrid = 0;"), [], "a listed word inside one run of lower-case letters is not caught: no dictionary splits it");
	for (const control of ["group", "route", "key", "nodal", "keys", "drawing", "linked"]) assert.deepEqual(caught(`const ${control} = 1;`), [], control);
});

test("I14: the vocabulary check passes over src, and fails on a word of draw's in a comment, a string or code", () => {
	assert.equal(run("check-vocabulary.mjs").status, 0);
	for (const text of ["// snaps a waypoint\nexport const a = 1;\n", 'export const a = "zone";\n', "export const layoutName = 1;\n", "/* the DIAGRAM */\n"]) {
		const dir = scratch({ "a.ts": text });
		try {
			const r = run("check-vocabulary.mjs", dir);
			assert.equal(r.status, 1, text);
			assert.match(r.stdout, /FAIL/);
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I14: the traps section 7 names for an input component are caught, and no contract name of section 3 holds a listed word", () => {
	const lists = readVocabulary();
	const caught = (text) => findVocabulary(text, lists).map((f) => f.listed);
	assert.deepEqual(caught("// a keyboard shortcut"), ["keyboard"]);
	assert.deepEqual(caught("// keycaps"), ["keycap"]);
	assert.deepEqual(caught("// runs in Node.js and a browser"), ["node"]);
	assert.deepEqual(caught("// see https://example.com/link/page"), ["link"]);
	assert.deepEqual(caught("// pipes the fact through"), ["pipe"]);
	assert.deepEqual(caught("const anchorPoint = 1; // layout"), ["anchor", "layout"]);
	assert.deepEqual(caught("// a server runtime, a key, a press, a point"), []);
	const names = `composeBindingTable openGestureSession matchInput traceInput findOverlaps pointerDown pointerMove pointerUp pointerLost
pressMatched startGesture becomeGesture cancelGesture tenants owner rows guards state flag default refuses claim id on when opens field
threshold gestures name engaged button at x y beyond unmatched taken trigger crossed phase gesture was refusedBy hit match claimed ids
fact context facts contexts guardStates press start update become commit cancel click drop row from ok problems problem pointer table
session declaration not-an-object missing-property unknown-property invalid-value duplicate-id duplicate-field duplicate-name
state-and-flag state-without-flag flag-without-state declared-binding-table one-binding-match binding-match-trace binding-overlaps
declared-gesture-session press-travel live-gesture input-binding resolvePress keyDown keyUp keysLost keys held code released tracked
pointerId otherPointer handlers cancelled resolve held-keys press-resolution KeyOutcome KeysLostOutcome ResolvePressHandlers
ResolvePressOutcome KeyFact`;
	assert.deepEqual(findVocabulary(names, lists), []);
});

test("I14: the runtime check passes over dist, and fails on a bare or node: import, a dynamic import, or a runtime's global", () => {
	assert.equal(run("check-runtime.mjs").status, 0);
	const bad = [
		'import fs from "node:fs";\n',
		'import { x } from "some-package";\n',
		'export { y } from "@scope/pkg/sub";\n',
		'import "side-effect";\n',
		'const m = await import("./a.js");\n',
		"export const g = globalThis;\n",
		"export const p = process.env;\n",
		"const r = require;\n",
		"const b = Buffer.from([]);\n",
		"export const w = typeof window;\n",
		"export const d = document;\n",
		"export const s = self;\n",
		"export const t = `${global.x}`;\n",
		"const r = /'/; const p = process.env;\n",
		"if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n",
		"{} /'/.test(''); process.exit(); //'\n",
		"export const o = { self: 1 };\n",
		'export const e = eval("this");\n',
		"const F = Function; export const g = F(\"return this\")();\n",
		'export const n = new Function("return this")();\n',
		'export const c = (() => 0).constructor("return this")();\n',
		'export const b = (() => 0)["constructor"]("return this")();\n',
		'export const k = new (function () {}).constructor("return this")();\n',
	];
	// every plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I14: the runtime check allows only the globals the build uses -- exactly the built-ins its built files name, BigInt among them -- so a platform global fails however it is named", () => {
	const named = new Set();
	for (const file of fs.readdirSync(path.join(root, "dist")).filter((f) => f.endsWith(".js"))) {
		for (const { name } of freeGlobalReferences(parseModule(fs.readFileSync(path.join(root, "dist", file), "utf8"), file))) named.add(name);
	}
	assert.deepEqual([...named].sort(), [...ALLOWED_GLOBALS].sort(), "the allow-list is exactly the globals the built files name");
	for (const name of ["ArrayBuffer", "BigInt", "DataView"]) assert.ok(ALLOWED_GLOBALS.includes(name), `${name}, which the exact fallback uses`);
	const finding = (name) => `names the global ${name}, which is none of the built-ins the build uses`;
	const globals = ["MessageChannel", "EventSource", "Worker", "SharedWorker", "BroadcastChannel", "RTCPeerConnection", "Atomics", "SharedArrayBuffer", "WebSocket", "XMLHttpRequest", "fetch", "navigator", "location", "localStorage", "indexedDB", "postMessage", "structuredClone", "queueMicrotask", "Promise", "Proxy", "Symbol", "Date", "Intl", "WeakRef", "WeakMap", "arguments"];
	for (const name of globals) {
		assert.deepEqual(findRuntimeUses(`export const planted = () => ${name};\n`).map((f) => f.finding), [finding(name)], name);
	}
	assert.deepEqual(findRuntimeUses("export const a = new MessageChannel();\n").map((f) => f.finding), [finding("MessageChannel")], "constructed");
	assert.deepEqual(findRuntimeUses("export const a = typeof Worker;\n").map((f) => f.finding), [finding("Worker")], "under typeof");
	assert.deepEqual(findRuntimeUses("export const a = { Atomics };\n").map((f) => f.finding), [finding("Atomics")], "a shorthand property is a reference");
	assert.deepEqual(findRuntimeUses("export function f() { return Worker; }\nfunction g() { const Worker = 1; return Worker; }\nexport { g };\n").map((f) => [f.line, f.finding]), [[1, finding("Worker")]], "a name declared in another scope does not cover this one");
	const clean = [
		`export const a = () => [${ALLOWED_GLOBALS.join(", ")}];\n`,
		"export const b = (v) => BigInt(v) << 3n;\n",
		"const Worker = 1; export const a = Worker;\n",
		"export const a = (MessageChannel) => MessageChannel;\n",
		"export function f({ EventSource }) { return EventSource; }\n",
		"export const a = (x) => x.Worker + x?.Atomics + ({ BroadcastChannel: 1 }).BroadcastChannel;\n",
		"// MessageChannel, Worker and Atomics in a comment\nexport const s = \"new Worker(MessageChannel)\";\n",
		"export class Atomics2 { method() { return this.RTCPeerConnection; } }\n",
		"label: for (;;) { break label; }\nexport {};\n",
		"try { void 0; } catch (error) { void error; }\nexport {};\n",
		"import { Worker } from \"./worker.js\";\nexport const w = Worker;\n",
		"export const d = (record) => record.id + record.exponent;\n",
	];
	for (const text of clean) assert.deepEqual(findRuntimeUses(text), [], text);
	const dir = scratch(Object.fromEntries(globals.slice(0, 7).map((name, i) => [`global-${i}.js`, `export const planted = () => ${name};\n`])));
	try {
		const r = run("check-runtime.mjs", dir);
		assert.equal(r.status, 1);
		globals.slice(0, 7).forEach((name, i) => assert.match(r.stdout, new RegExp(`global-${i}\\.js:1  names the global ${name},`)));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("I14: a platform global planted in a copy of the built files is found, and the copy otherwise passes", () => {
	for (const [plant, name] of [["export const planted = () => new MessageChannel();\n", "MessageChannel"], ["export const planted = () => Atomics.wait;\n", "Atomics"], ["export const planted = () => typeof Worker;\n", "Worker"]]) {
		const dir = scratchFolder("input-binding-dist-");
		try {
			fs.cpSync(path.join(root, "dist"), dir, { recursive: true });
			assert.equal(run("check-runtime.mjs", dir).status, 0, "the unplanted copy passes");
			const file = path.join(dir, "travel-beyond.js");
			fs.writeFileSync(file, `${fs.readFileSync(file, "utf8")}\n${plant}`);
			const r = run("check-runtime.mjs", dir);
			assert.equal(r.status, 1, name);
			assert.match(r.stdout, new RegExp(`travel-beyond\\.js:\\d+  names the global ${name},`));
		} finally {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

test("I14: the runtime check reads names in code only, never in comments or strings, nor as members", () => {
	const clean = '// globalThis, process and require( in a comment\nimport { a } from "./a.js";\nconst options = {}, b = 1, c = 2;\nexport * from "../b.js";\nconst s = "window document self";\nconst q = \'process\';\nconst t = `import("x") ${a.process}`;\nconst o = { x: options.self };\nconst d = a / b / c;\nconst r = [/"/g, /\\//];\n/* Buffer */\n';
	assert.deepEqual(findRuntimeUses(clean), []);
	assert.deepEqual(findRuntimeUses("const t = `a ${globalThis.x} b`;\n").map((f) => f.finding), ["names globalThis"]);
	assert.deepEqual(findRuntimeUses("const r = /'/; const p = process.env;\n").map((f) => f.finding), ["names process"], "a quote inside a regular expression begins no string");
	assert.deepEqual(findRuntimeUses("const s = 'process';\n"), [], "a name inside a string is not a finding");
	assert.deepEqual(findRuntimeUses("const g = global; const r = require;\n").map((f) => f.finding), ["names global", "names require"], "contextual keywords are names too");
	assert.deepEqual(findRuntimeUses("if (Math.PI) /'/.test(''); globalThis.x = 1; //'\n").map((f) => f.finding), ["names globalThis"], "a regular expression after ) is no division");
	assert.deepEqual(findRuntimeUses("{} /'/.test(''); process.exit(); //'\n").map((f) => f.finding), ["names process"], "a regular expression after a block's } is no division");
	assert.deepEqual(findRuntimeUses("const o = { self: 1 };\n").map((f) => f.finding), ["names self"], "an object-literal key is counted");
	assert.deepEqual(findRuntimeUses("const a = {}; const m = import.meta.url; const n = a?.process;\n"), [], "import.meta is no dynamic import, and an optional member is a member");
	assert.deepEqual(findRuntimeUses('const x = {}, y = {}, o = {}; const a = x.eval; const b = y.Function; const s = "eval(Function)"; const c = o.constructor; const d = o.constructor === Object; // eval\n'), [], "eval and Function as members, in strings and comments, and a constructor read but not called, pass");
	assert.deepEqual(findRuntimeUses('const g = eval("this");\n').map((f) => f.finding), ["names eval"]);
	assert.deepEqual(findRuntimeUses('const g = new Function("return this")();\n').map((f) => f.finding), ["names Function"]);
	assert.deepEqual(findRuntimeUses('const f = () => 0; const g = f.constructor("return this")();\n').map((f) => f.finding), ["calls through a property named constructor, which reaches Function"]);
	assert.throws(() => findRuntimeUses('const s = "open;\n'), /could not parse/);
});

test("IB13: the clock and chance check passes over dist, and fails on a clock, a timer, chance or a network planted in a built file -- by bracket or by destructuring too", () => {
	assert.equal(run("check-clock-and-chance.mjs").status, 0);
	const bad = [
		"export const a = Date.now();\n",
		"export const b = Math.random();\n",
		'export const c = Math["random"]();\n',
		"const { random } = Math; export const d = random();\n",
		"const { random: chance } = Math; export const e = chance();\n",
		"let r; ({ random: r } = Math); export const f = r();\n",
		"const m = Math; export const g = m.random();\n",
		'export const h = Math["max"](1, 2);\n',
		"export const i = [Math][0].random();\n",
		"const { now } = Date; export const j = now();\n",
		"const { now } = performance; export const k = now();\n",
		"export const l = performance.now();\n",
		"setTimeout(() => 0, 1);\n",
		"queueMicrotask(() => 0);\n",
		"export const n = crypto.getRandomValues(new Uint8Array(1));\n",
		"export const o = new Date();\n",
		"export const p = `${Math[`random`]()}`;\n",
		"function q({ random } = Math) { return random(); }\nexport { q };\n",
		"export const r = new Intl.DateTimeFormat().format();\n",
		"const { DateTimeFormat } = Intl; export const s = DateTimeFormat;\n",
		"export const u = Temporal.Now.instant();\n",
		"export const v = new WeakRef({});\n",
		"export const w = new FinalizationRegistry(() => 0);\n",
	];
	for (const text of bad) assert.ok(findClockAndChance(text).length > 0, text);
	// every plant a file of its own in one copy, run through the tool once: each must be reported
	const dir = scratch(Object.fromEntries(bad.map((text, i) => [`plant-${String(i).padStart(2, "0")}.js`, text])));
	try {
		const r = run("check-clock-and-chance.mjs", dir);
		assert.equal(r.status, 1);
		assert.match(r.stdout, /FAIL/);
		bad.forEach((text, i) => assert.match(r.stdout, new RegExp(`plant-${String(i).padStart(2, "0")}\\.js:`), text));
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

test("IB13: the clock and chance check reads code only, and passes a direct member access by identifier", () => {
	const clean = [
		"export const a = Math.max(1, 2);\n",
		"export const b = Math.min(...[3, 4]) + Math.floor(1.5) + Math.abs(-1);\n",
		"// Date.now(), Math.random() and setTimeout in a comment\nexport const c = 'Math.random() and Date.now()';\n",
		"export const d = options.Date + record.performance + x.random;\n",
		"const { random } = other; export const e = random;\n",
		"export const f = options.Intl + record.Temporal + held.WeakRef + held.FinalizationRegistry;\n",
		"// Intl.DateTimeFormat, Temporal.Now, new WeakRef and FinalizationRegistry in a comment\nexport const g = 'Intl Temporal WeakRef';\n",
	];
	for (const text of clean) assert.deepEqual(findClockAndChance(text), [], text);
	assert.deepEqual(findClockAndChance('export const c = Math["random"]();\n').map((f) => f.finding), ["reads Math.random by brackets", "uses Math as a value, not as a direct member access by identifier"]);
	assert.deepEqual(findClockAndChance("const { random } = Math; random();\n").map((f) => f.finding), ["destructures from Math", "uses Math as a value, not as a direct member access by identifier"]);
	assert.throws(() => findClockAndChance('const s = "open;\n'), /could not parse/);
});

test("the release workflow retries the lookup of the draft it created, bounded, before it requires exactly one", () => {
	const text = fs.readFileSync(path.join(root, ".github", "workflows", "release.yml"), "utf8");
	const step = text.slice(text.indexOf("- name: create a draft release"), text.indexOf("- name: download both back"));
	const loop = /for attempt in ((?:\d+ )+\d+); do\n\s+ids=\$\(gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases" --jq "[^\n]*select\(\.draft and \.tag_name == [^\n]*\n\s+\[ -n "\$ids" \] && break\n\s+sleep (\d+)\n\s+done/.exec(step);
	assert.ok(loop, "the lookup is inside a loop that stops once it finds the draft");
	const attempts = loop[1].split(" ").length, pause = Number(loop[2]);
	assert.ok(attempts >= 2 && attempts * pause <= 120, `bounded: ${attempts} attempts, ${pause} seconds apart`);
	assert.ok(step.indexOf("gh release create") < loop.index && loop.index < step.indexOf("expected one draft release"), "after the create, before exactly one draft is required");
});
