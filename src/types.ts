/**
 * The public types of input-binding, one per noun of CONTRACT.md's vocabulary.
 *
 * Every type binding makes is read-only: what it returns is frozen to its depth, down to but not into the
 * caller's own values it holds -- a row, a fact, a context, a guard state -- which are returned by
 * reference and never copied, frozen or changed. The table's types are generic in the fact and the
 * context, so a consumer's predicates are typed against its own facts (IB13).
 */

/** A non-null object, not a function, of any prototype, with finite number properties x and y. */
export interface Point {
	readonly x: number;
	readonly y: number;
}

/** A pure function an application supplies, whose truthy answer means yes. */
export type Predicate<Argument> = (argument: Argument) => unknown;

/**
 * A declared meaning: an id, a predicate `on` over facts, an optional predicate `when` over contexts, the
 * flags the table's declaration names, the field naming the gesture it opens, and the application's own
 * payload, which the table never reads.
 */
export interface BindingRow<Fact = unknown, Context = unknown> {
	readonly id: string;
	readonly on: Predicate<Fact>;
	readonly when?: Predicate<Context>;
	readonly [property: string]: unknown;
}

/** A source of rows, named by its owner. */
export interface BindingTenant<Row> {
	readonly owner: string;
	readonly rows: readonly Row[];
}

/** How a guard refuses a row, `s` the guard state's value of its state and `f` the row's value of its flag (IB5). */
export type GuardRefusal = "state-and-flag" | "state-without-flag" | "flag-without-state";

/** A declared rule refusing rows by a state and a row's flag (IB5). */
export interface BindingGuard {
	readonly state: string;
	readonly flag: string;
	readonly default: boolean;
	readonly refuses: GuardRefusal;
}

/** The row flag by which a row claims an input its `on` matches, and its default (IB7). */
export interface BindingClaim {
	readonly flag: string;
	readonly default: boolean;
}

/** The row property in which a row names the gesture a press it matches opens (IB11). */
export interface BindingOpens {
	readonly field: string;
}

/** A table's declaration (IB3): tenants in order, and optionally guards, a claim and the field naming what a row opens. */
export interface BindingTableDeclaration<Fact = unknown, Context = unknown, Row extends BindingRow<Fact, Context> = BindingRow<Fact, Context>> {
	readonly tenants: readonly BindingTenant<Row>[];
	readonly guards?: readonly BindingGuard[];
	readonly claim?: BindingClaim;
	readonly opens?: BindingOpens;
}

/** The codes a refused declaration's problems carry (IB3, IB9). */
export type DeclarationProblemCode = "not-an-object" | "unknown-property" | "missing-property" | "invalid-value" | "duplicate-field" | "duplicate-id" | "duplicate-name";

/** One problem of a refused declaration: an RFC 6901 pointer into it, and a code. */
export interface DeclarationProblem {
	readonly pointer: string;
	readonly problem: DeclarationProblemCode;
}

/** A declaration refused with every problem it has. */
export interface RefusedDeclaration {
	readonly ok: false;
	readonly problems: readonly DeclarationProblem[];
}

/** A record of named boolean states handed with an input; a state it omits is false (IB5). */
export interface GuardState {
	readonly [state: string]: boolean;
}

/** One row of a table: its id, its owner, the gesture it opens or null, and the declared row itself (IB4). */
export interface BindingEntry<Row = BindingRow> {
	readonly id: string;
	readonly owner: string;
	readonly opens: string | null;
	readonly row: Row;
}

/** How far one row matched one input: refused by a guard, unbound, unmet, or a hit (IB6). */
export interface TraceRecord {
	readonly id: string;
	readonly owner: string;
	readonly refusedBy: string | null;
	readonly on: boolean | null;
	readonly when: boolean | null;
	readonly hit: boolean;
}

/** The one row an input means, or none, and whether the input is claimed (IB7). */
export interface MatchAnswer<Row = BindingRow> {
	readonly match: BindingEntry<Row> | null;
	readonly claimed: boolean;
}

/** A combination of fact, context and guard state in which two or more rows hit (IB8). */
export interface Overlap<Fact = unknown, Context = unknown> {
	readonly fact: Fact;
	readonly context: Context;
	readonly guards: GuardState;
	readonly ids: readonly string[];
}

/** The rows of several tenants, composed once; it holds no state, and any number of callers may share one (IB4). */
export interface BindingTable<Fact = unknown, Context = unknown, Row extends BindingRow<Fact, Context> = BindingRow<Fact, Context>> {
	readonly rows: readonly BindingEntry<Row>[];
	readonly guards: readonly BindingGuard[];
	readonly claim: BindingClaim | null;
	readonly opens: BindingOpens | null;
	traceInput(fact: Fact, context: Context, guards?: GuardState): readonly TraceRecord[];
	matchInput(fact: Fact, context: Context, guards?: GuardState): MatchAnswer<Row>;
	findOverlaps(facts: readonly Fact[], contexts: readonly Context[], guardStates: readonly GuardState[]): readonly Overlap<Fact, Context>[];
}

/** What composeBindingTable returns: the table, or every problem of its declaration (IB3). */
export type ComposeBindingTableResult<Fact = unknown, Context = unknown, Row extends BindingRow<Fact, Context> = BindingRow<Fact, Context>> =
	| { readonly ok: true; readonly table: BindingTable<Fact, Context, Row> }
	| RefusedDeclaration;

/** A declared gesture: its name, whether it is engaged while live, and the button it takes and is committed by, or null (IB9). */
export interface GestureDeclaration {
	readonly name: string;
	readonly engaged: boolean;
	readonly button: number | null;
}

/** A session's declaration: the threshold, in the units of the facts' `at`, and the gestures (IB9). */
export interface GestureSessionDeclaration {
	readonly threshold: number;
	readonly gestures: readonly GestureDeclaration[];
}

/** A pointer button held: where it went down, whether it has travelled beyond the threshold, and whether it is still unmatched (IB10). */
export interface Press {
	readonly at: Point;
	readonly beyond: boolean;
	readonly unmatched: boolean;
}

/** The one gesture started and not yet ended: its name, the id of the row that opened it or null, and whether it is engaged (IB11). */
export interface LiveGesture {
	readonly name: string;
	readonly row: string | null;
	readonly engaged: boolean;
}

/** A session's whole state (IB12). */
export interface SessionState {
	readonly press: Press | null;
	readonly gesture: LiveGesture | null;
}

/** A step of a gesture's life binding makes due (IB11). */
export type Phase = "start" | "update" | "become" | "commit" | "cancel";

/** What a release is: a click when its press never went beyond the threshold, a drop otherwise (IB10). */
export type Trigger = "click" | "drop";

/** What every operation answers: the state it leaves, the phase it made due or null, and the gesture that phase concerns or null (IB12). */
export interface GestureOutcome {
	readonly state: SessionState;
	readonly phase: Phase | null;
	readonly gesture: LiveGesture | null;
}

/** pointerDown's outcome: no phase, and whether the live gesture took the press. */
export interface PointerDownOutcome extends GestureOutcome {
	readonly phase: null;
	readonly gesture: null;
	readonly taken: boolean;
}

/** pointerMove's outcome: and whether this move made the press beyond the threshold. */
export interface PointerMoveOutcome extends GestureOutcome {
	readonly crossed: boolean;
}

/** pointerUp's outcome: and what the release is. */
export interface PointerUpOutcome extends GestureOutcome {
	readonly trigger: Trigger;
}

/** becomeGesture's outcome: and the gesture as it was. */
export interface BecomeGestureOutcome extends GestureOutcome {
	readonly was: LiveGesture;
}

/** The fact pointerDown reads: its `at` and its `button`, own data properties; every other property is unread. */
export interface PointerDownFact {
	readonly at: Point;
	readonly button: number;
}

/** The fact pointerMove reads: its `at`, an own data property. */
export interface PointerMoveFact {
	readonly at: Point;
}

/** The fact pointerUp reads: its `button`, an own data property. */
export interface PointerUpFact {
	readonly button: number;
}

/** What pressMatched reads of a match: its id, and the gesture it opens or null (IB11). */
export interface PressMatch {
	readonly id: string;
	readonly opens: string | null;
}

/** startGesture's argument: a declared gesture, and optionally the opening row's id and a point a held press restarts from (IB11). */
export interface StartGestureArgs {
	readonly gesture: string;
	readonly row?: string;
	readonly from?: Point;
}

/** becomeGesture's argument: a declared gesture, and optionally a point a held press restarts from (IB11). */
export interface BecomeGestureArgs {
	readonly gesture: string;
	readonly from?: Point;
}

/** The state of one input surface's presses and gestures between calls, opened and owned by the application (IB9 to IB12). */
export interface GestureSession {
	readonly declaration: GestureSessionDeclaration;
	readonly state: SessionState;
	pointerDown(fact: PointerDownFact): PointerDownOutcome;
	pressMatched(match: PressMatch): GestureOutcome;
	pointerMove(fact: PointerMoveFact): PointerMoveOutcome;
	pointerUp(fact: PointerUpFact): PointerUpOutcome;
	pointerLost(): GestureOutcome;
	startGesture(args: StartGestureArgs): GestureOutcome;
	becomeGesture(args: BecomeGestureArgs): BecomeGestureOutcome;
	cancelGesture(): GestureOutcome;
}

/** What openGestureSession returns: the session, or every problem of its declaration (IB9). */
export type OpenGestureSessionResult = { readonly ok: true; readonly session: GestureSession } | RefusedDeclaration;
