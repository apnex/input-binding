// public-types - input-binding's published types (IB13): compiled from a consumer in test/types/, under strict
// settings with and without exactOptionalPropertyTypes. traceInput's and matchInput's context may be omitted
// exactly when undefined is assignable to the table's context type (IB2 rule 3); the session's outcomes,
// facts, keys and resolvePress are typed. The consumer's @ts-expect-error lines must each fail to compile, or
// tsc reports the directive unused; and, compiled again with the directives taken out, each must fail on its
// own line and no other line may, so no expected error passes for a reason other than its own.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { scratchFolder } from "@apnex/test-harness";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsc = path.join(root, "node_modules", ".bin", "tsc");
const consumer = path.join(root, "test", "types", "context-consumer.mts");
const flags = ["--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--lib", "ES2022", "--skipLibCheck", "false"];
const MODES = [["strict", []], ["strict, exactOptionalPropertyTypes", ["--exactOptionalPropertyTypes"]]];
const DIRECTIVE = /^\s*\/\/ @ts-expect-error -- (.*)$/;

/** tsc over a file: its diagnostics' output, empty when it compiles. */
function compile(file, extra, cwd) {
	try {
		execFileSync(tsc, [...extra, ...flags, file], { cwd, encoding: "utf8", stdio: "pipe" });
		return "";
	} catch (e) {
		return `${e.stdout}${e.stderr}`;
	}
}

for (const [label, extra] of MODES) {
	test(`a consumer type-checks against the public entry point, every expected error failing (${label})`, () => {
		const output = compile(consumer, extra, root);
		assert.equal(output, "", `the consumer does not compile:\n${output}`);
	});
}

for (const [label, extra] of MODES) {
	test(`with the directives taken out, each expected error fails on its own line and nothing else fails (${label})`, () => {
		const lines = readFileSync(consumer, "utf8").split("\n");
		const expected = [];
		const stripped = lines.map((line, index) => {
			if (!DIRECTIVE.test(line)) return line;
			expected.push(index + 2);
			return "";
		});
		const dir = scratchFolder("input-binding-types-");
		try {
			mkdirSync(path.join(dir, "node_modules", "@apnex"), { recursive: true });
			symlinkSync(root, path.join(dir, "node_modules", "@apnex", "input-binding"), "dir");
			writeFileSync(path.join(dir, "consumer.mts"), stripped.join("\n"));
			const output = compile("consumer.mts", extra, dir);
			const failing = [...output.matchAll(/^consumer\.mts\((\d+),\d+\): error/gm)].map((match) => Number(match[1]));
			assert.deepEqual([...new Set(failing)], expected, output);
			assert.ok(expected.length >= 15, `${expected.length} expected errors`);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
}
