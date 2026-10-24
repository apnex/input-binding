/**
 * The gesture session (CONTRACT.md, IB9 to IB15): one input surface's press, its one live gesture and the
 * keys held, and which phase of that gesture each input makes due.
 *
 * Five operations take what a pointer did -- pointerDown, pressMatched, pointerMove, pointerUp,
 * pointerLost -- three take the application's requests -- startGesture, becomeGesture, cancelGesture --
 * each checked against the same lifecycle; resolvePress takes a press through pointerDown and pressMatched
 * in one call; and three take what the key source delivered -- keyDown, keyUp, keysLost. Every operation
 * reads and checks all its arguments first, in IB2's order, and only then reads the session's state, so a
 * point's getter or a Proxy's trap that calls the session takes effect before the transition, which sees
 * what it left. A refused operation throws an Error whose message begins with its name, and changes nothing.
 *
 * The session's state is one frozen value, replaced exactly when it changes (IB12). The session holds
 * nothing of a fact but a copy of its `at`, its `button` and its `pointerId`, and of a key fact its `code`
 * while the key is held; and no working data of a gesture: the live gesture is a name, a row and `engaged`.
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
	KeyFact,
	KeyOutcome,
	KeysLostOutcome,
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
	ResolvePressHandlers,
	ResolvePressOutcome,
	SessionState,
	StartGestureArgs,
} from "./types.js";

/** A point binding copies: each coordinate written v + 0, so no state holds -0. */
interface Coordinates {
	readonly x: number;
	readonly y: number;
}

/** What pointerDown reads of its fact: the point, the button and the pointer, each number written v + 0. */
interface DownFact {
	readonly at: Coordinates;
	readonly button: number;
	readonly pointer: number | null;
}

/** What pressMatched reads of a match: its id, and the gesture it opens or null. */
interface ReadMatch {
	readonly id: string;
	readonly opens: string | null;
}

const START_FORM: ReadonlySet<string> = new Set(["gesture", "row", "from"]);
const BECOME_FORM: ReadonlySet<string> = new Set(["gesture", "from"]);
const HANDLERS_FORM: ReadonlySet<string> = new Set(["match", "cancelled"]);

/** The fact an operation reads: a non-null object, not a function, of any prototype (IB1). */
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
	return button.value + 0;
}

/**
 * A fact's `pointerId` (IB1): read by its descriptor alone, no own keys read, so a descriptor that reads
 * undefined is absent and means null; otherwise a data property holding null or a safe integer.
 */
function readFactPointerId(fn: string, fact: object): number | null {
	const pointerId = readOwnData(fn, fact, "pointerId", "the fact's pointerId");
	if (!pointerId.present || pointerId.value === null) return null;
	if (typeof pointerId.value !== "number" || !Number.isSafeInteger(pointerId.value)) throw malformed(fn, "the fact's pointerId must be null or a safe integer");
	return pointerId.value + 0;
}

/** A key fact's `code` (IB1): an own data property holding a string or null. */
function readFactCode(fn: string, fact: object): string | null {
	const code = readOwnData(fn, fact, "code", "the fact's code");
	if (!code.present) throw malformed(fn, "the fact must hold code, an own data property");
	if (code.value !== null && typeof code.value !== "string") throw malformed(fn, "the fact's code must be a string or null");
	return code.value;
}

/** What pointerDown reads, in IB2's order: the fact; its at; that point's x and y; its button; its pointerId. */
function readDownFact(fn: string, fact: unknown): DownFact {
	const read = readFact(fn, fact);
	const at = readFactAt(fn, read);
	const button = readFactButton(fn, read);
	const pointer = readFactPointerId(fn, read);
	return { at, button, pointer };
}

/** IB12: the press an operation leaves -- the very same record when every field equals the old one's, its at likewise. */
function pressOf(old: Press | null, at: Coordinates, beyond: boolean, unmatched: boolean, button: number, pointer: number | null): Press {
	const sameAt = old !== null && old.at.x === at.x && old.at.y === at.y;
	if (old !== null && sameAt && old.beyond === beyond && old.unmatched === unmatched && old.button === button && old.pointer === pointer) return old;
	return Object.freeze({ at: sameAt && old !== null ? old.at : Object.freeze({ x: at.x, y: at.y }), beyond, unmatched, button, pointer });
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

	let state: SessionState = Object.freeze({ press: null, gesture: null, keys: Object.freeze([]) });

	/**
	 * IB15's "the press": which press the session holds, counted -- a new number at every pointerDown, the
	 * one resolvePress makes among them, and 0 once pointerUp or pointerLost ends it; a move or a restart,
	 * which change the press's record, keep its number.
	 */
	let pressCount = 0;
	let pressNumber = 0;

	/** IB12: the state an operation leaves -- the very same value when its press, its gesture and its keys are. */
	function settle(press: Press | null, gesture: LiveGesture | null, keys: readonly string[] = state.keys): SessionState {
		if (press !== state.press || gesture !== state.gesture || keys !== state.keys) state = Object.freeze({ press, gesture, keys });
		return state;
	}

	/** The declaration of a gesture the session declares. */
	const declarationOf = (name: string): GestureDeclaration => declared.get(name) as GestureDeclaration;

	/** The declared button of the live gesture, or null when none is live or it declares none. */
	const liveButton = (): number | null => (state.gesture === null ? null : declarationOf(state.gesture.name).button);

	/** A gesture argument's `gesture`: an own data property naming a gesture the session declares. */
	function readGestureName(fn: string, args: object): string {
		const gesture = readOwnData(fn, args, "gesture", "the argument's gesture");
		if (!gesture.present) throw malformed(fn, "the argument must hold gesture");
		if (typeof gesture.value !== "string" || !declared.has(gesture.value)) throw malformed(fn, "the argument's gesture must name a gesture the session declares");
		return gesture.value;
	}

	/** An argument's own keys: only the form's, and `required` among them. */
	function readArgumentKeys(fn: string, args: object, form: ReadonlySet<string>, label: string, required: string): ReadonlySet<string> {
		const keys = readOwnStringKeys(fn, args, label);
		for (const key of keys) if (!form.has(key)) throw malformed(fn, `${label} holds ${JSON.stringify(key)}, which is not ${[...form].join(", ")}`);
		if (!keys.includes(required)) throw malformed(fn, `${label} must hold ${required}`);
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

	/** A match, as pressMatched reads one: its prototype, its id, a non-empty string, and its opens, a declared name or null. */
	function readMatch(fn: string, match: unknown, label: string): ReadMatch {
		const read = requirePlainObject(fn, match, label);
		const id = readOwnData(fn, read, "id", `${label}'s id`);
		if (!id.present || typeof id.value !== "string" || id.value.length === 0) throw malformed(fn, `${label} must hold id, a non-empty string`);
		const opens = readOwnData(fn, read, "opens", `${label}'s opens`);
		if (!opens.present || (opens.value !== null && (typeof opens.value !== "string" || !declared.has(opens.value)))) throw malformed(fn, `${label} must hold opens, a gesture the session declares or null`);
		return { id: id.value, opens: opens.value as string | null };
	}

	/** IB10: a held press restarts from `from`, not beyond, keeping unmatched, its button and its pointer; with no press, nothing changes. */
	const restart = (press: Press | null, from: Coordinates | null): Press | null => (press === null || from === null ? press : pressOf(press, from, false, press.unmatched, press.button, press.pointer));

	const outcome = (phase: Phase | null, gesture: LiveGesture | null): GestureOutcome => Object.freeze({ state, phase, gesture });

	/** IB10, IB11: pointerDown's transition -- the press replaced, taken when the live gesture declares its button; answers taken. */
	function downTransition(down: DownFact): boolean {
		const declaredButton = liveButton();
		const taken = declaredButton !== null && declaredButton === down.button;
		pressNumber = ++pressCount;
		settle(pressOf(state.press, down.at, false, !taken, down.button, down.pointer), state.gesture);
		return taken;
	}

	/** IB11: pressMatched's transition, the press unmatched -- a cancel of the live gesture, or the start the match opens, or an action. */
	function matchedTransition(match: ReadMatch): GestureOutcome {
		const press = state.press as Press;
		const live = state.gesture;
		if (live !== null) {
			settle(press, null);
			return outcome("cancel", live);
		}
		const unmatchedNoMore = pressOf(press, press.at, press.beyond, false, press.button, press.pointer);
		if (match.opens === null) {
			settle(unmatchedNoMore, null);
			return outcome(null, null);
		}
		const started = gestureOf(null, match.opens, match.id, declarationOf(match.opens).engaged);
		settle(unmatchedNoMore, started);
		return outcome("start", started);
	}

	/** IB14: a key's outcome; `held` null when the key is untracked. */
	const keyOutcome = (tracked: boolean, held: boolean | null): KeyOutcome => Object.freeze({ state, tracked, held });

	const session: GestureSession = {
		declaration: sessionDeclaration,
		get state(): SessionState {
			return state;
		},
		/** IB10, IB11: replaces the press; the live gesture takes it when it declares the fact's button. */
		pointerDown(fact: PointerDownFact): PointerDownOutcome {
			const down = readDownFact("pointerDown", fact);
			const taken = downTransition(down);
			return Object.freeze({ state, phase: null, gesture: null, taken });
		},
		/** IB11: a press that matched a row cancels the gesture in progress, or starts the gesture the row opens, or means an action. */
		pressMatched(match: PressMatch): GestureOutcome {
			const fn = "pressMatched";
			const read = readMatch(fn, match, "the match");
			const press = state.press;
			if (press === null || !press.unmatched) throw new Error(`${fn}: there is no unmatched press -- ${press === null ? "no press is held" : "the press was taken or has matched already"}`);
			return matchedTransition(read);
		},
		/** IB10, IB11: decides the press's travel, exactly; an update is due while a gesture is live; another pointer's move changes nothing. */
		pointerMove(fact: PointerMoveFact): PointerMoveOutcome {
			const fn = "pointerMove";
			const read = readFact(fn, fact);
			const at = readFactAt(fn, read);
			const pointer = readFactPointerId(fn, read);
			const press = state.press;
			if (press !== null && pointer !== press.pointer) return Object.freeze({ state, phase: null, gesture: null, crossed: false, otherPointer: true });
			const crossed = press !== null && !press.beyond && travelBeyond(press.at.x, press.at.y, at.x, at.y, threshold);
			const live = state.gesture;
			settle(crossed && press !== null ? pressOf(press, press.at, true, press.unmatched, press.button, press.pointer) : press, live);
			return Object.freeze({ state, phase: live === null ? null : "update", gesture: live, crossed, otherPointer: false });
		},
		/**
		 * IB10, IB11: ends the press with its trigger; commits the live gesture when it declares no button, the
		 * fact's, or the press's; another pointer's release changes nothing.
		 */
		pointerUp(fact: PointerUpFact): PointerUpOutcome {
			const fn = "pointerUp";
			const read = readFact(fn, fact);
			const button = readFactButton(fn, read);
			const pointer = readFactPointerId(fn, read);
			const press = state.press;
			if (press !== null && pointer !== press.pointer) return Object.freeze({ state, phase: null, gesture: null, trigger: null, otherPointer: true });
			const trigger = press !== null && press.beyond ? "drop" : "click";
			const live = state.gesture;
			const declaredButton = liveButton();
			const commits = live !== null && (declaredButton === null || declaredButton === button || (press !== null && declaredButton === press.button));
			pressNumber = 0;
			settle(null, commits ? null : live);
			return Object.freeze({ state, phase: commits ? "commit" : null, gesture: commits ? live : null, trigger, otherPointer: false });
		},
		/** IB10, IB11: the platform has taken the pointer: the press ends with no trigger, and the live gesture is cancelled. */
		pointerLost(): GestureOutcome {
			const live = state.gesture;
			pressNumber = 0;
			settle(null, null);
			return live === null ? outcome(null, null) : outcome("cancel", live);
		},
		/** IB11: the application's request to start a gesture, refused while one is live. */
		startGesture(args: StartGestureArgs): GestureOutcome {
			const fn = "startGesture";
			const read = requirePlainObject(fn, args, "the argument");
			const keys = readArgumentKeys(fn, read, START_FORM, "the argument", "gesture");
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
			const keys = readArgumentKeys(fn, read, BECOME_FORM, "the argument", "gesture");
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
		/**
		 * IB15: a press resolved in one call -- pointerDown's transition; then, unless the press is taken, the
		 * application's `match`; then pressMatched's transition while the press is still unmatched; and, when that
		 * cancels a live gesture, the application's `cancelled` and pressMatched's transition once more while the
		 * press is still unmatched and no gesture is live. The state is read again after each callback returns.
		 */
		resolvePress<Match extends PressMatch>(fact: PointerDownFact, handlers: ResolvePressHandlers<Match>): ResolvePressOutcome<Match> {
			const fn = "resolvePress";
			// step 1: the fact, as pointerDown reads it; then the handlers, as startGesture reads its argument
			const down = readDownFact(fn, fact);
			const read = requirePlainObject(fn, handlers, "the handlers");
			const keys = readArgumentKeys(fn, read, HANDLERS_FORM, "the handlers", "match");
			const matchProperty = readOwnData(fn, read, "match", "the handlers' match");
			if (!matchProperty.present) throw malformed(fn, "the handlers must hold match");
			if (typeof matchProperty.value !== "function") throw malformed(fn, "the handlers' match must be a function");
			const match = matchProperty.value as () => unknown;
			let cancelled: ((outcome: GestureOutcome) => unknown) | null = null;
			if (keys.has("cancelled")) {
				const cancelledProperty = readOwnData(fn, read, "cancelled", "the handlers' cancelled");
				if (cancelledProperty.present) {
					if (typeof cancelledProperty.value !== "function") throw malformed(fn, "the handlers' cancelled must be a function");
					cancelled = cancelledProperty.value as (outcome: GestureOutcome) => unknown;
				}
			}
			const answer = (taken: boolean, answered: unknown, cancelOutcome: GestureOutcome | null, resolution: GestureOutcome | null): ResolvePressOutcome<Match> =>
				Object.freeze({
					state,
					taken,
					match: answered as Match | null,
					cancelled: cancelOutcome,
					phase: resolution === null ? null : (resolution.phase as "start" | null),
					gesture: resolution === null ? null : resolution.gesture,
				});
			// step 2: pointerDown's transition; a taken press means nothing more
			const taken = downTransition(down);
			if (taken) return answer(true, null, null, null);
			const thePress = pressNumber;
			const stillUnmatched = (): boolean => pressNumber === thePress && state.press !== null && state.press.unmatched;
			// step 3: the application's match, with no receiver and no argument; its answer read once
			const answered: unknown = Reflect.apply(match, undefined, []);
			if (answered === null) return answer(false, null, null, null);
			const matched = readMatch(fn, answered, "match's answer");
			// step 4
			if (!stillUnmatched()) return answer(false, answered, null, null);
			const first = matchedTransition(matched);
			if (first.phase !== "cancel") return answer(false, answered, null, first);
			// step 5
			if (cancelled !== null) Reflect.apply(cancelled, undefined, [first]);
			if (!stillUnmatched() || state.gesture !== null) return answer(false, answered, first, null);
			return answer(false, answered, first, matchedTransition(matched));
		},
		/** IB14: a key pressed -- a non-empty code not held appended; '' and null untracked. */
		keyDown(fact: KeyFact): KeyOutcome {
			const fn = "keyDown";
			const code = readFactCode(fn, readFact(fn, fact));
			if (code === null || code === "") return keyOutcome(false, null);
			const held = state.keys.includes(code);
			if (!held) settle(state.press, state.gesture, Object.freeze([...state.keys, code]));
			return keyOutcome(true, held);
		},
		/** IB14: a key released -- a non-empty code held removed; '' and null untracked. */
		keyUp(fact: KeyFact): KeyOutcome {
			const fn = "keyUp";
			const code = readFactCode(fn, readFact(fn, fact));
			if (code === null || code === "") return keyOutcome(false, null);
			const held = state.keys.includes(code);
			if (held) settle(state.press, state.gesture, Object.freeze(state.keys.filter((key) => key !== code)));
			return keyOutcome(true, held);
		},
		/** IB14: the key source lost focus -- every code removed; `released` the very array held before. */
		keysLost(): KeysLostOutcome {
			const released = state.keys;
			if (released.length > 0) settle(state.press, state.gesture, Object.freeze([]));
			return Object.freeze({ state, released });
		},
	};
	for (const key of ["pointerDown", "pressMatched", "pointerMove", "pointerUp", "pointerLost", "startGesture", "becomeGesture", "cancelGesture", "resolvePress", "keyDown", "keyUp", "keysLost"] as const) Object.freeze(session[key]);
	const stateGetter = Object.getOwnPropertyDescriptor(session, "state")?.get;
	if (stateGetter !== undefined) Object.freeze(stateGetter);
	return Object.freeze({ ok: true as const, session: Object.freeze(session) });
}
