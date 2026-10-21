/**
 * The gesture session (CONTRACT.md, IB9 to IB12): one input surface's press and its one live gesture,
 * and which phase of that gesture each input makes due.
 *
 * Five operations take what a person did -- pointerDown, pressMatched, pointerMove, pointerUp,
 * pointerLost -- and three take the application's requests -- startGesture, becomeGesture,
 * cancelGesture -- each checked against the same lifecycle. Every operation reads and checks all its
 * arguments first, in IB2's order, and only then reads the session's state, so a point's getter or a
 * Proxy's trap that calls the session takes effect before the transition, which sees what it left.
 * A refused operation throws an Error whose message begins with its name, and changes nothing.
 *
 * The session's state is one frozen value, replaced exactly when it changes (IB12). The session holds
 * nothing of a fact but a copy of its `at`, and no working data of a gesture: the live gesture is a
 * name, a row and `engaged`.
 */
import { malformed, readOwnData, readOwnStringKeys, readPoint, requireObjectValue, requirePlainObject } from "./argument-reading.js";
import { checkSessionDeclaration } from "./session-declaration.js";
import { travelBeyond } from "./travel-beyond.js";
import type {
	BecomeGestureArgs,
	BecomeGestureOutcome,
	GestureDeclaration,
	GestureOutcome,
	GestureSession,
	LiveGesture,
	OpenGestureSessionResult,
	Phase,
	PointerDownFact,
	PointerDownOutcome,
	PointerMoveFact,
	PointerMoveOutcome,
	PointerUpFact,
	PointerUpOutcome,
	Press,
	PressMatch,
	SessionState,
	StartGestureArgs,
} from "./types.js";

/** A point binding copies: each coordinate written v + 0, so no state holds -0. */
interface Coordinates {
	readonly x: number;
	readonly y: number;
}

const START_FORM: ReadonlySet<string> = new Set(["gesture", "row", "from"]);
const BECOME_FORM: ReadonlySet<string> = new Set(["gesture", "from"]);

/** The fact a pointer operation reads: a non-null object, not a function, of any prototype (IB1). */
const readFact = (fn: string, fact: unknown): object => requireObjectValue(fn, fact, "the fact");

/** A fact's `at`: an own data property holding a point, its x and y then read (IB1, IB2). */
function readFactAt(fn: string, fact: object): Coordinates {
	const at = readOwnData(fn, fact, "at", "the fact's at");
	if (!at.present) throw malformed(fn, "the fact must hold at, an own data property");
	const { x, y } = readPoint(fn, at.value, "the fact's at");
	return { x: x + 0, y: y + 0 };
}

/** A fact's `button`: an own data property holding a safe integer (IB1). */
function readFactButton(fn: string, fact: object): number {
	const button = readOwnData(fn, fact, "button", "the fact's button");
	if (!button.present) throw malformed(fn, "the fact must hold button, an own data property");
	if (typeof button.value !== "number" || !Number.isSafeInteger(button.value)) throw malformed(fn, "the fact's button must be a safe integer");
	return button.value;
}

/** IB12: the press an operation leaves -- the very same record when every field equals the old one's, its at likewise. */
function pressOf(old: Press | null, at: Coordinates, beyond: boolean, unmatched: boolean): Press {
	const sameAt = old !== null && old.at.x === at.x && old.at.y === at.y;
	if (old !== null && sameAt && old.beyond === beyond && old.unmatched === unmatched) return old;
	return Object.freeze({ at: sameAt && old !== null ? old.at : Object.freeze({ x: at.x, y: at.y }), beyond, unmatched });
}

/** IB12: the live gesture an operation leaves -- the very same record when every field equals the old one's. */
function gestureOf(old: LiveGesture | null, name: string, row: string | null, engaged: boolean): LiveGesture {
	if (old !== null && old.name === name && old.row === row && old.engaged === engaged) return old;
	return Object.freeze({ name, row, engaged });
}

/**
 * IB9: opens a session from a threshold and the gestures an application declares, or refuses the
 * declaration with every problem it has, each naming where it lies. Never throws, for any argument.
 */
export function openGestureSession(declaration: { readonly threshold: number; readonly gestures: readonly GestureDeclaration[] }): OpenGestureSessionResult {
	const checked = checkSessionDeclaration(declaration);
	if (!checked.ok) return checked.problems.refusal();

	const threshold = checked.threshold;
	const gestures = Object.freeze(checked.gestures.map((g) => Object.freeze({ name: g.name, engaged: g.engaged, button: g.button })));
	const declared: ReadonlyMap<string, GestureDeclaration> = new Map(gestures.map((g) => [g.name, g]));
	const sessionDeclaration = Object.freeze({ threshold, gestures });

	let state: SessionState = Object.freeze({ press: null, gesture: null });

	/** IB12: the state an operation leaves -- the very same value when its press and its gesture are. */
	function settle(press: Press | null, gesture: LiveGesture | null): SessionState {
		if (press !== state.press || gesture !== state.gesture) state = Object.freeze({ press, gesture });
		return state;
	}

	/** The declaration of a gesture the session declares. */
	const declarationOf = (name: string): GestureDeclaration => declared.get(name) as GestureDeclaration;

	/** A gesture argument's `gesture`: an own data property naming a gesture the session declares. */
	function readGestureName(fn: string, args: object): string {
		const gesture = readOwnData(fn, args, "gesture", "the argument's gesture");
		if (!gesture.present) throw malformed(fn, "the argument must hold gesture");
		if (typeof gesture.value !== "string" || !declared.has(gesture.value)) throw malformed(fn, "the argument's gesture must name a gesture the session declares");
		return gesture.value;
	}

	/** A gesture argument's own keys: only the form's, and gesture among them. */
	function readArgumentKeys(fn: string, args: object, form: ReadonlySet<string>): ReadonlySet<string> {
		const keys = readOwnStringKeys(fn, args, "the argument");
		for (const key of keys) if (!form.has(key)) throw malformed(fn, `the argument holds ${JSON.stringify(key)}, which is not ${[...form].join(", ")}`);
		if (!keys.includes("gesture")) throw malformed(fn, "the argument must hold gesture");
		return new Set(keys);
	}

	/** A gesture argument's `from`, if it holds one: an own data property holding a point, its x and y then read. */
	function readFrom(fn: string, args: object, keys: ReadonlySet<string>): Coordinates | null {
		if (!keys.has("from")) return null;
		const from = readOwnData(fn, args, "from", "the argument's from");
		if (!from.present) return null;
		const { x, y } = readPoint(fn, from.value, "the argument's from");
		return { x: x + 0, y: y + 0 };
	}

	/** IB10: a held press restarts from `from`, not beyond, keeping unmatched; with no press, nothing changes. */
	const restart = (press: Press | null, from: Coordinates | null): Press | null => (press === null || from === null ? press : pressOf(press, from, false, press.unmatched));

	const outcome = (phase: Phase | null, gesture: LiveGesture | null): GestureOutcome => Object.freeze({ state, phase, gesture });

	const session: GestureSession = {
		declaration: sessionDeclaration,
		get state(): SessionState {
			return state;
		},
		/** IB10, IB11: replaces the press; the live gesture takes it when it declares the fact's button. */
		pointerDown(fact: PointerDownFact): PointerDownOutcome {
			const fn = "pointerDown";
			const read = readFact(fn, fact);
			const at = readFactAt(fn, read);
			const button = readFactButton(fn, read);
			const live = state.gesture;
			const declaredButton = live === null ? null : declarationOf(live.name).button;
			const taken = declaredButton !== null && declaredButton === button;
			settle(pressOf(state.press, at, false, !taken), live);
			return Object.freeze({ state, phase: null, gesture: null, taken });
		},
		/** IB11: a press that matched a row cancels the gesture in progress, or starts the gesture the row opens, or means an action. */
		pressMatched(match: PressMatch): GestureOutcome {
			const fn = "pressMatched";
			const read = requirePlainObject(fn, match, "the match");
			const id = readOwnData(fn, read, "id", "the match's id");
			if (!id.present || typeof id.value !== "string" || id.value.length === 0) throw malformed(fn, "the match must hold id, a non-empty string");
			const opens = readOwnData(fn, read, "opens", "the match's opens");
			if (!opens.present || (opens.value !== null && (typeof opens.value !== "string" || !declared.has(opens.value)))) throw malformed(fn, "the match must hold opens, a gesture the session declares or null");
			const press = state.press;
			if (press === null || !press.unmatched) throw new Error(`${fn}: there is no unmatched press -- ${press === null ? "no press is held" : "the press was taken or has matched already"}`);
			const live = state.gesture;
			if (live !== null) {
				settle(press, null);
				return outcome("cancel", live);
			}
			const unmatchedNoMore = pressOf(press, press.at, press.beyond, false);
			if (opens.value === null) {
				settle(unmatchedNoMore, null);
				return outcome(null, null);
			}
			const started = gestureOf(null, opens.value as string, id.value, declarationOf(opens.value as string).engaged);
			settle(unmatchedNoMore, started);
			return outcome("start", started);
		},
		/** IB10, IB11: decides the press's travel, exactly; an update is due while a gesture is live. */
		pointerMove(fact: PointerMoveFact): PointerMoveOutcome {
			const fn = "pointerMove";
			const read = readFact(fn, fact);
			const at = readFactAt(fn, read);
			const press = state.press;
			const crossed = press !== null && !press.beyond && travelBeyond(press.at.x, press.at.y, at.x, at.y, threshold);
			const live = state.gesture;
			settle(crossed && press !== null ? pressOf(press, press.at, true, press.unmatched) : press, live);
			return Object.freeze({ state, phase: live === null ? null : "update", gesture: live, crossed });
		},
		/** IB10, IB11: ends the press with its trigger; commits the live gesture when it declares no button or the fact's. */
		pointerUp(fact: PointerUpFact): PointerUpOutcome {
			const fn = "pointerUp";
			const read = readFact(fn, fact);
			const button = readFactButton(fn, read);
			const trigger = state.press !== null && state.press.beyond ? "drop" : "click";
			const live = state.gesture;
			const declaredButton = live === null ? null : declarationOf(live.name).button;
			const commits = live !== null && (declaredButton === null || declaredButton === button);
			settle(null, commits ? null : live);
			return Object.freeze({ state, phase: commits ? "commit" : null, gesture: commits ? live : null, trigger });
		},
		/** IB10, IB11: the platform has taken the pointer: the press ends with no trigger, and the live gesture is cancelled. */
		pointerLost(): GestureOutcome {
			const live = state.gesture;
			settle(null, null);
			return live === null ? outcome(null, null) : outcome("cancel", live);
		},
		/** IB11: the application's request to start a gesture, refused while one is live. */
		startGesture(args: StartGestureArgs): GestureOutcome {
			const fn = "startGesture";
			const read = requirePlainObject(fn, args, "the argument");
			const keys = readArgumentKeys(fn, read, START_FORM);
			const name = readGestureName(fn, read);
			let row: string | null = null;
			if (keys.has("row")) {
				const given = readOwnData(fn, read, "row", "the argument's row");
				if (given.present) {
					if (typeof given.value !== "string" || given.value.length === 0) throw malformed(fn, "the argument's row must be a non-empty string");
					row = given.value;
				}
			}
			const from = readFrom(fn, read, keys);
			if (state.gesture !== null) throw new Error(`${fn}: a gesture is live already, ${JSON.stringify(state.gesture.name)}`);
			const started = gestureOf(null, name, row, declarationOf(name).engaged);
			settle(restart(state.press, from), started);
			return outcome("start", started);
		},
		/** IB11: the application's request that the live gesture become another, within the same life; refused while none is live. */
		becomeGesture(args: BecomeGestureArgs): BecomeGestureOutcome {
			const fn = "becomeGesture";
			const read = requirePlainObject(fn, args, "the argument");
			const keys = readArgumentKeys(fn, read, BECOME_FORM);
			const name = readGestureName(fn, read);
			const from = readFrom(fn, read, keys);
			const was = state.gesture;
			if (was === null) throw new Error(`${fn}: no gesture is live`);
			const become = gestureOf(was, name, was.row, declarationOf(name).engaged);
			settle(restart(state.press, from), become);
			return Object.freeze({ state, phase: "become", gesture: become, was });
		},
		/** IB11: the application's request to cancel the live gesture; with none live, no phase. */
		cancelGesture(): GestureOutcome {
			const live = state.gesture;
			if (live === null) return outcome(null, null);
			settle(state.press, null);
			return outcome("cancel", live);
		},
	};
	for (const key of ["pointerDown", "pressMatched", "pointerMove", "pointerUp", "pointerLost", "startGesture", "becomeGesture", "cancelGesture"] as const) Object.freeze(session[key]);
	const stateGetter = Object.getOwnPropertyDescriptor(session, "state")?.get;
	if (stateGetter !== undefined) Object.freeze(stateGetter);
	return Object.freeze({ ok: true as const, session: Object.freeze(session) });
}
