/**
 * Reading the arguments of every function but the two constructors (CONTRACT.md, "Errors" and IB2).
 *
 * Each argument is read once, in the order IB2's table gives, each read checked as it is made, and the
 * first that is malformed throws a TypeError whose message begins with the function's name, reading
 * nothing after it. An error a getter or a Proxy trap throws while an argument is read is rethrown as the
 * function's own TypeError. Every argument but a point is read by descriptor, so no getter of it is
 * called; a point's x and y are read once each through ordinary property access, x first, both before
 * either is checked, so a DOMPoint's getters answer.
 */
import { judgeArray } from "./reflection.js";

/** A TypeError whose message begins with the function's name. */
export function malformed(fn: string, what: string): TypeError {
	return new TypeError(`${fn}: ${what}`);
}

const messageOf = (error: unknown): string => {
	try {
		return error instanceof Error ? error.message : String(error);
	} catch {
		return "an unreadable error";
	}
};

/** The TypeError for a value whose reading threw: a getter's or a trap's error, rethrown as the function's own. */
export function unreadable(fn: string, label: string, error: unknown): TypeError {
	return malformed(fn, `${label} could not be read: ${messageOf(error)}`);
}

/** IB2 rule 5: a non-null value whose typeof is 'object', so a function is not one; nothing of it is read. */
export function requireObjectValue(fn: string, value: unknown, label: string): object {
	if (typeof value !== "object" || value === null) throw malformed(fn, `${label} must be a non-null object, not a function`);
	return value;
}

/** IB2 rule 1: a plain object, its prototype Object.prototype or null, the prototype read once. */
export function requirePlainObject(fn: string, value: unknown, label: string): object {
	if (typeof value !== "object" || value === null) throw malformed(fn, `${label} must be a plain object`);
	let proto: unknown;
	try {
		proto = Object.getPrototypeOf(value);
	} catch (error) {
		throw unreadable(fn, label, error);
	}
	if (proto !== Object.prototype && proto !== null) throw malformed(fn, `${label} must be a plain object, its prototype Object.prototype or null`);
	return value;
}

/** The own string-named keys of a value, in their own order; symbol-named keys are ignored. */
export function readOwnStringKeys(fn: string, value: object, label: string): string[] {
	try {
		return Reflect.ownKeys(value).filter((key): key is string => typeof key === "string");
	} catch (error) {
		throw unreadable(fn, label, error);
	}
}

/** One own property read by its descriptor: absent, or present with its value; an accessor is present and of no form, so malformed. */
export type OwnData = { readonly present: false } | { readonly present: true; readonly value: unknown };

/** Reads an own property by its descriptor, never calling a getter; an accessor is malformed, an inherited property absent. */
export function readOwnData(fn: string, value: object, key: string, label: string): OwnData {
	let descriptor: PropertyDescriptor | undefined;
	try {
		descriptor = Reflect.getOwnPropertyDescriptor(value, key);
	} catch (error) {
		throw unreadable(fn, label, error);
	}
	if (descriptor === undefined) return { present: false };
	if (!("value" in descriptor)) throw malformed(fn, `${label} must be an own data property, not an accessor`);
	return { present: true, value: descriptor.value };
}

/** IB2 rule 5: a point's x then y, read once each through ordinary property access, both read before either is checked; each must be a finite number. */
export function readPoint(fn: string, value: unknown, label: string): { readonly x: number; readonly y: number } {
	const form = `${label} must be a point: a non-null object, not a function, with finite number properties x and y`;
	if (typeof value !== "object" || value === null) throw malformed(fn, form);
	let x: unknown, y: unknown;
	try {
		x = (value as { readonly x: unknown }).x;
		y = (value as { readonly y: unknown }).y;
	} catch (error) {
		throw unreadable(fn, label, error);
	}
	if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) throw malformed(fn, form);
	return { x, y };
}

/** An array argument, read as rule 8 reads one: Array.isArray, its prototype, its own keys, its length's descriptor and its elements' in index order. */
export function readArrayArgument(fn: string, value: unknown, label: string): readonly unknown[] {
	const judged = judgeArray(value);
	if (judged.refused === false) return judged.elements;
	if (judged.refused === "thrown") throw unreadable(fn, label, judged.error);
	throw malformed(fn, `${label} must be a dense array of Array.prototype, holding no own property but its indices and length`);
}

/**
 * A guard state (IB5): a plain object whose own string-named properties each name a state the table's
 * guards declare and hold a boolean as a data property. Read as IB2's table says: its prototype, its own
 * keys -- each checked to name a declared state -- then each property's descriptor in the order the keys
 * gave. Answers the states it holds; a state it omits is false.
 */
export function readGuardState(fn: string, value: unknown, declaredStates: ReadonlySet<string>, label: string): ReadonlyMap<string, boolean> {
	const record = requirePlainObject(fn, value, label);
	const keys = readOwnStringKeys(fn, record, label);
	for (const key of keys) if (!declaredStates.has(key)) throw malformed(fn, `${label} names ${JSON.stringify(key)}, a state no guard of the table declares`);
	const states = new Map<string, boolean>();
	for (const key of keys) {
		const property = readOwnData(fn, record, key, `${label}.${key}`);
		if (!property.present) continue;
		if (typeof property.value !== "boolean") throw malformed(fn, `${label}.${key} must be a boolean`);
		states.set(key, property.value);
	}
	return states;
}
