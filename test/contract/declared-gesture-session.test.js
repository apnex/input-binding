// declared-gesture-session - IB9 (I1): a session opened from a threshold and the gestures an application
// declares, or refused with every problem; the reading order of its declaration, held by Proxies that
// record each trap, reading 3's declaration among them; and what a session's declaration holds.
import assert from "node:assert/strict";
import { test } from "node:test";

import { openGestureSession } from "@apnex/input-binding";
import { holdsNegativeZero, isFrozenToDepth } from "../support/frozen.js";
import { recorded, revoked, trapping } from "../support/recording-proxy.js";

const p = (pointer, problem) => ({ pointer, problem });
const DRAG = { name: "drag", engaged: true, button: null };
const accessor = (target, name) => Object.defineProperty(target, name, { get: () => assert.fail(`the getter of ${name} ran`), enumerable: true, configurable: true });
const label = (v) => {
	try {
		return String(v);
	} catch {
		return "a value String cannot show";
	}
};

function problemsOf(declaration) {
	const result = openGestureSession(declaration);
	assert.equal(result.ok, false, "the declaration is refused");
	return result.problems.map((x) => ({ pointer: x.pointer, problem: x.problem }));
}

test("I1: openGestureSession never throws, for any value, and refuses a value that is not a plain object at \"\" alone", () => {
	for (const value of [undefined, null, 4, "d", true, 1n, [], () => ({}), new Map(), Object.create({ threshold: 4, gestures: [] }), revoked({ threshold: 4, gestures: [] }), trapping({ threshold: 4, gestures: [] }, "ownKeys"), trapping({ threshold: 4, gestures: [] }, "getOwnPropertyDescriptor")]) {
		assert.deepEqual(problemsOf(value), [p("", "not-an-object")], label(value));
	}
	assert.deepEqual(problemsOf(), [p("", "not-an-object")]);
	for (const value of [{ threshold: 4, gestures: revoked([]) }, { threshold: 4, gestures: [trapping({}, "getPrototypeOf")] }]) assert.doesNotThrow(() => openGestureSession(value));
});

test("IB9 steps 2 and 3: unknown and missing properties; the threshold a finite number at least 0", () => {
	assert.deepEqual(problemsOf({}), [p("/gestures", "missing-property"), p("/threshold", "missing-property")]);
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [], extra: 1, "a~b": 2 }), [p("/a~0b", "unknown-property"), p("/extra", "unknown-property")]);
	for (const threshold of [-1, -Number.MIN_VALUE, NaN, Infinity, -Infinity, "4", null, undefined, 4n, {}]) assert.deepEqual(problemsOf({ threshold, gestures: [] }), [p("/threshold", "invalid-value")], label(threshold));
	assert.deepEqual(problemsOf(accessor({ gestures: [] }, "threshold")), [p("/threshold", "invalid-value")]);
	for (const threshold of [0, -0, Number.MIN_VALUE, 4, 1e308, Number.MAX_VALUE]) assert.equal(openGestureSession({ threshold, gestures: [] }).ok, true, String(threshold));
});

test("IB9 step 4: gestures, each gesture's name, engaged and button", () => {
	for (const gestures of [5, {}, null, undefined, new Array(1), Object.assign([], { x: 1 }), revoked([]), Object.defineProperty([DRAG], 1, { get: () => DRAG, enumerable: true })]) {
		assert.deepEqual(problemsOf({ threshold: 4, gestures }), [p("/gestures", "invalid-value")], label(gestures));
	}
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [5, null, [], revoked({})] }), [0, 1, 2, 3].map((k) => p(`/gestures/${k}`, "not-an-object")));
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [{}] }), [p("/gestures/0/button", "missing-property"), p("/gestures/0/engaged", "missing-property"), p("/gestures/0/name", "missing-property")]);
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [{ ...DRAG, take: 0 }] }), [p("/gestures/0/take", "unknown-property")]);
	const bad = [["name", ""], ["name", 5], ["name", undefined], ["engaged", "true"], ["engaged", 1], ["engaged", undefined], ["button", 0.5], ["button", 2 ** 53], ["button", NaN], ["button", "0"], ["button", undefined], ["button", Infinity]];
	for (const [name, value] of bad) assert.deepEqual(problemsOf({ threshold: 4, gestures: [{ ...DRAG, [name]: value }] }), [p(`/gestures/0/${name}`, "invalid-value")], `${name}: ${label(value)}`);
	for (const name of ["name", "engaged", "button"]) {
		const g = { ...DRAG };
		delete g[name];
		assert.deepEqual(problemsOf({ threshold: 4, gestures: [accessor(g, name)] }), [p(`/gestures/0/${name}`, "invalid-value")], `an accessor ${name}`);
	}
	for (const button of [null, 0, -1, 2 ** 53 - 1, -(2 ** 53 - 1), -0]) assert.equal(openGestureSession({ threshold: 4, gestures: [{ ...DRAG, button }] }).ok, true, String(button));
	assert.deepEqual(problemsOf({ threshold: -1, gestures: [5, { ...DRAG, name: "" }] }), [p("/gestures/0", "not-an-object"), p("/gestures/1/name", "invalid-value"), p("/threshold", "invalid-value")], "every problem, each at its pointer");
});

test("IB9 step 5: a name equal to an earlier valid one", () => {
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [DRAG, { ...DRAG, engaged: false }, { name: "drag", engaged: 1, button: null }] }), [p("/gestures/1/name", "duplicate-name"), p("/gestures/2/engaged", "invalid-value"), p("/gestures/2/name", "duplicate-name")]);
	assert.deepEqual(problemsOf({ threshold: 4, gestures: [{ name: 5, engaged: true, button: null }, DRAG, DRAG] }), [p("/gestures/0/name", "invalid-value"), p("/gestures/2/name", "duplicate-name")]);
});

test("IB9: the declaration is a frozen copy { threshold, gestures }, each gesture { name, engaged, button }, -0 written 0", () => {
	const gestures = [{ button: -0, engaged: false, name: "a" }, { name: "b", engaged: true, button: null }];
	const declaration = { gestures, threshold: -0 };
	const { session } = openGestureSession(declaration);
	assert.deepEqual(session.declaration, { threshold: 0, gestures: [{ name: "a", engaged: false, button: 0 }, { name: "b", engaged: true, button: null }] });
	assert.deepEqual(Object.keys(session.declaration), ["threshold", "gestures"]);
	assert.deepEqual(Object.keys(session.declaration.gestures[0]), ["name", "engaged", "button"]);
	assert.ok(!holdsNegativeZero(session.declaration));
	assert.ok(Object.is(session.declaration.threshold, 0) && Object.is(session.declaration.gestures[0].button, 0));
	assert.notEqual(session.declaration.gestures, gestures);
	assert.ok(isFrozenToDepth(session.declaration));
	assert.ok(!Object.isFrozen(declaration) && !Object.isFrozen(gestures[0]), "the argument is not frozen");
	gestures[0].name = "changed";
	assert.equal(session.declaration.gestures[0].name, "a", "a copy");
});

test("IB9: a session holds its declaration, its state and its eight operations, frozen; two sessions share nothing", () => {
	const opened = openGestureSession({ threshold: 4, gestures: [DRAG] });
	assert.deepEqual(Object.keys(opened), ["ok", "session"]);
	assert.deepEqual(Object.keys(opened.session), ["declaration", "state", "pointerDown", "pressMatched", "pointerMove", "pointerUp", "pointerLost", "startGesture", "becomeGesture", "cancelGesture"]);
	assert.ok(isFrozenToDepth(opened));
	assert.deepEqual(opened.session.state, { press: null, gesture: null });
	const other = openGestureSession({ threshold: 4, gestures: [DRAG] }).session;
	assert.notEqual(other.state, opened.session.state);
	opened.session.pointerDown({ at: { x: 0, y: 0 }, button: 0 });
	assert.equal(other.state.press, null);
	const { pointerDown, startGesture } = other;
	startGesture({ gesture: "drag" });
	pointerDown({ at: { x: 1, y: 1 }, button: 0 });
	assert.equal(other.state.gesture.name, "drag", "an operation needs no receiver");
	assert.equal(opened.session.state.gesture, null);
});

test("IB2 rule 8: a session's declaration is read whole, value by value, threshold before gestures", () => {
	const log = [];
	const g0 = recorded({ ...DRAG }, "g0", log), g1 = recorded({ name: "b", engaged: false, button: 0 }, "g1", log);
	const gestures = recorded([g0, g1], "gestures", log);
	assert.equal(openGestureSession(recorded({ gestures, threshold: 4 }, "declaration", log)).ok, true);
	const record = (l, names) => [`${l} getPrototypeOf`, `${l} ownKeys`, ...names.map((n) => `${l} getOwnPropertyDescriptor ${n}`)];
	assert.deepEqual(log, [...record("declaration", ["threshold", "gestures"]), "gestures getPrototypeOf", "gestures ownKeys", "gestures getOwnPropertyDescriptor length", "gestures getOwnPropertyDescriptor 0", "gestures getOwnPropertyDescriptor 1", ...record("g0", ["name", "engaged", "button"]), ...record("g1", ["name", "engaged", "button"])]);
	const refused = [];
	const bad = recorded(Object.create(Array.prototype), "bad", refused);
	assert.deepEqual(problemsOf(recorded({ threshold: 4, gestures: [recorded({ name: "", engaged: true, button: null, x: 1 }, "g", refused), bad] }, "declaration", refused)), [p("/gestures/0/name", "invalid-value"), p("/gestures/0/x", "unknown-property"), p("/gestures/1", "not-an-object")]);
	assert.deepEqual(refused, [...record("declaration", ["threshold", "gestures"]), ...record("g", ["name", "engaged", "button"]), "bad getPrototypeOf"], "an unknown property is known by its key alone, and nothing beneath a refused value is read");
});

test("IB2 rule 8, reading 3: a declaration whose gestures descriptor trap rewrites the threshold has had its threshold read", () => {
	const target = { threshold: 4, gestures: [DRAG] };
	const declaration = new Proxy(target, {
		getOwnPropertyDescriptor(t, key) {
			if (key === "gestures") t.threshold = 8;
			return Reflect.getOwnPropertyDescriptor(t, key);
		},
	});
	const opened = openGestureSession(declaration);
	assert.equal(opened.ok, true);
	assert.equal(opened.session.declaration.threshold, 4);
	assert.equal(target.threshold, 8, "the trap ran, after the threshold was read");
	const rewritesGestures = new Proxy(
		{ threshold: 4, gestures: [DRAG] },
		{
			getOwnPropertyDescriptor(t, key) {
				if (key === "threshold") t.gestures = 5;
				return Reflect.getOwnPropertyDescriptor(t, key);
			},
		},
	);
	assert.deepEqual(problemsOf(rewritesGestures), [p("/gestures", "invalid-value")], "a trap on threshold runs before gestures' descriptor is read");
});

test("I1: a transparent Proxy is answered as its target", () => {
	const t = (v) => new Proxy(v, {});
	const opened = openGestureSession(t({ threshold: 2, gestures: t([t({ ...DRAG })]) }));
	assert.equal(opened.ok, true);
	assert.deepEqual(opened.session.declaration, { threshold: 2, gestures: [DRAG] });
});
