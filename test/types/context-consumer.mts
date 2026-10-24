// A TypeScript consumer of input-binding's public entry point, compiled by public-types.test.js under
// strict settings: traceInput's and matchInput's context may be omitted exactly when undefined is
// assignable to the table's context type (IB2 rule 3), and must be given otherwise. Each line marked as
// an expected error must fail to compile, or the compile fails.
import { composeBindingTable, openGestureSession, type BindingEntry, type BindingRow, type BindingTable, type GestureOutcome, type GuardState, type KeyFact, type KeyOutcome, type KeysLostOutcome, type MatchAnswer, type ResolvePressHandlers, type ResolvePressOutcome, type SessionState, type TraceRecord } from "@apnex/input-binding";

type LooseRow = BindingRow<Fact, Situation | undefined>;

interface Fact {
	readonly key: string;
	readonly button: number;
	readonly at: { readonly x: number; readonly y: number };
}
interface Situation {
	readonly mode: "edit" | "view";
}
interface Row extends BindingRow<Fact, Situation> {
	readonly run?: string;
	readonly gesture?: string;
}

const fact: Fact = { key: "a", button: 0, at: { x: 0, y: 0 } };
const guards: GuardState = { readOnly: false };

// A context type that admits undefined: the context may be omitted, or given as undefined.
declare const loose: BindingTable<Fact, Situation | undefined>;
const a1: MatchAnswer<LooseRow> = loose.matchInput(fact);
const a2: readonly TraceRecord[] = loose.traceInput(fact);
const a3 = loose.matchInput(fact, undefined, guards);
const a4 = loose.matchInput(fact, { mode: "edit" });
const a5 = loose.traceInput(fact, undefined, undefined);

// The default context, unknown, admits undefined too.
const opened = composeBindingTable({ tenants: [{ owner: "a", rows: [{ id: "x", on: () => true }] }] });
if (opened.ok) {
	opened.table.matchInput(null);
	opened.table.traceInput(null, undefined, {});
	opened.table.findOverlaps([null], [undefined], [{}]);
}

// A context type that does not admit undefined: the context must be given.
const composed = composeBindingTable<Fact, Situation, Row>({ claim: { flag: "prevent", default: true }, opens: { field: "gesture" }, tenants: [{ owner: "a", rows: [{ id: "x", on: (f) => f.key === "a", when: (s) => s.mode === "edit", run: "act" }] }] });
if (composed.ok) {
	const strict: BindingTable<Fact, Situation, Row> = composed.table;
	const b1 = strict.matchInput(fact, { mode: "view" });
	const b2 = strict.matchInput(fact, { mode: "view" }, guards);
	const b3 = strict.traceInput(fact, { mode: "edit" }, undefined);
	const run: string | undefined = b1.match?.row.run;
	// @ts-expect-error -- the context is required when undefined is not assignable to it
	strict.matchInput(fact);
	// @ts-expect-error -- and for traceInput
	strict.traceInput(fact);
	// @ts-expect-error -- undefined is not a Situation
	strict.matchInput(fact, undefined);
	// @ts-expect-error -- a context of another type
	strict.matchInput(fact, { mode: "other" });
	// @ts-expect-error -- a guard state's states are booleans
	strict.matchInput(fact, { mode: "edit" }, { readOnly: 1 });
	void [b2, b3, run];
}

// A predicate is typed against the table's facts and contexts.
// @ts-expect-error -- Fact has no property missing
composeBindingTable<Fact, Situation>({ tenants: [{ owner: "a", rows: [{ id: "x", on: (f) => f.missing }] }] });
// @ts-expect-error -- Situation has no property missing
composeBindingTable<Fact, Situation>({ tenants: [{ owner: "a", rows: [{ id: "x", on: () => true, when: (s) => s.missing }] }] });

// The session takes facts holding at and button, and its outcomes are typed.
declare const table: BindingTable<Fact, Situation, Row>;
const session = openGestureSession({ threshold: 4, gestures: [{ name: "move", engaged: true, button: null }] });
if (session.ok) {
	const down = session.session.pointerDown(fact);
	const taken: boolean = down.taken;
	const up = session.session.pointerUp(fact);
	const trigger: "click" | "drop" | null = up.trigger;
	// @ts-expect-error -- the trigger is null when the release was another pointer's
	const always: "click" | "drop" = up.trigger;
	const other: boolean = up.otherPointer;
	// @ts-expect-error -- pointerMove needs a fact holding at
	session.session.pointerMove({ button: 0 });
	void [taken, trigger, always, other];

	// The press holds its button and its pointer; the state the keys held.
	const state: SessionState = session.session.state;
	const button: number | undefined = state.press?.button;
	const pointer: number | null | undefined = state.press?.pointer;
	const keys: readonly string[] = state.keys;
	// @ts-expect-error -- the keys held cannot be written
	state.keys.push("KeyA");

	// A fact as capture makes one, its pointerId null or a number, is a pointer fact.
	const delivered = { at: { x: 1, y: 2 }, button: 0, pointerId: null, buttons: 1, key: null };
	session.session.pointerMove(delivered);
	session.session.pointerUp({ button: 2, pointerId: 7 });

	// Keys, held and lost.
	const keyFact: KeyFact = { code: "KeyA" };
	const pressed: KeyOutcome = session.session.keyDown({ code: "KeyA", key: "a", repeat: false } as KeyFact);
	const held: boolean | null = pressed.held;
	const untracked: KeyOutcome = session.session.keyUp({ code: null });
	const lost: KeysLostOutcome = session.session.keysLost();
	const released: readonly string[] = lost.released;
	// @ts-expect-error -- a key fact holds code
	session.session.keyDown({ key: "a" });
	// @ts-expect-error -- a code is a string or null
	session.session.keyUp({ code: 65 });

	// A press resolved in one call, its match a table's match.
	const handlers: ResolvePressHandlers<BindingEntry<Row>> = {
		match: () => table.matchInput(fact, { mode: "edit" }).match,
		cancelled: (outcome: GestureOutcome) => outcome.gesture?.name,
	};
	const resolved: ResolvePressOutcome<BindingEntry<Row>> = session.session.resolvePress(fact, handlers);
	const run: string | undefined = resolved.match?.row.run;
	const phase: "start" | null = resolved.phase;
	const inferred = session.session.resolvePress(fact, { match: () => null });
	const nothing: { readonly id: string; readonly opens: string | null } | null = inferred.match;
	// @ts-expect-error -- the handlers hold match
	session.session.resolvePress(fact, { cancelled: () => undefined });
	// @ts-expect-error -- match answers a match or null
	session.session.resolvePress(fact, { match: () => "row" });
	// @ts-expect-error -- the phase is never cancel, which cancelled alone reports
	const cancelPhase: "cancel" = resolved.phase;
	void [button, pointer, keys, keyFact, held, untracked, released, run, phase, nothing, cancelPhase];
}

void [a1, a2, a3, a4, a5];
