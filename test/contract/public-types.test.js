// public-types - input-binding's published types (IB13): compiled from a consumer in test/types/, under strict
// settings with and without exactOptionalPropertyTypes. traceInput's and matchInput's context may be omitted
// exactly when undefined is assignable to the table's context type (IB2 rule 3); the consumer's
// @ts-expect-error lines hold the other case, so a type that made the context always optional, or always
// required, fails the compile.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const tsc = path.join(root, "node_modules", ".bin", "tsc");
const consumer = path.join(root, "test", "types", "context-consumer.mts");
const base = ["--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--target", "ES2022", "--lib", "ES2022", "--skipLibCheck", "false", consumer];

for (const [label, extra] of [["strict", []], ["strict, exactOptionalPropertyTypes", ["--exactOptionalPropertyTypes"]]]) {
	test(`a consumer type-checks against the public entry point (${label})`, () => {
		assert.doesNotThrow(() => execFileSync(tsc, [...extra, ...base], { cwd: root, encoding: "utf8", stdio: "pipe" }), "the consumer does not compile");
	});
}
