/**
 * The binding table (CONTRACT.md, IB3 to IB8): tenants' rows composed once, and for one input in its
 * context under a guard state, every row's standing, the one match or none, and the overlaps.
 *
 * A table holds no state and changes in no way after composition. It reads each row once, at
 * composition, and holds what it read with the row itself, which it hands back by reference; it never
 * reads a fact or a context, handing each to the application's predicates unread. Guards are applied
 * first, then every admitted row's `on` in table order, then every bound row's `when` in table order,
 * each predicate called with no receiver and one argument, its answer taken as `if` takes it.
 */
import { malformed, readArrayArgument, readGuardState } from "./argument-reading.js";
import { checkBindingDeclaration, type CheckedRow } from "./binding-declaration.js";
import type { BindingEntry, BindingGuard, BindingRow, BindingTable, BindingTableDeclaration, ComposeBindingTableResult, ContextAndGuards, GuardState, MatchAnswer, Overlap, TraceRecord } from "./types.js";

/** Each row's standing for one input: refused by a guard's flag, or `on`'s and `when`'s answers (IB6's three passes). */
interface Standing {
	readonly refusedBy: readonly (string | null)[];
	readonly on: readonly (boolean | null)[];
	readonly when: readonly (boolean | null)[];
}

/** IB5: whether one guard refuses a row, `s` the guard state's value of its state and `f` the row's value of its flag. */
function guardRefuses(guard: BindingGuard, s: boolean, f: boolean): boolean {
	switch (guard.refuses) {
		case "state-and-flag":
			return s && f;
		case "state-without-flag":
			return s && !f;
		case "flag-without-state":
			return f && !s;
	}
}

/** Freezes a function binding made, so the table frozen to its depth holds nothing that can change. */
const frozenFunction = <F extends (...args: never[]) => unknown>(f: F): F => Object.freeze(f);

/**
 * IB3: composes a table from a declaration, or refuses it with every problem it has, each naming where
 * it lies. Never throws, for any argument.
 */
export function composeBindingTable<Fact = unknown, Context = unknown, Row extends BindingRow<Fact, Context> = BindingRow<Fact, Context>>(
	declaration: BindingTableDeclaration<Fact, Context, Row>,
): ComposeBindingTableResult<Fact, Context, Row> {
	const checked = checkBindingDeclaration(declaration);
	if (!checked.ok) return checked.problems.refusal();

	const guards = Object.freeze(checked.guards.map((g) => Object.freeze({ state: g.state, flag: g.flag, default: g.default, refuses: g.refuses })));
	const claim = checked.claim === null ? null : Object.freeze({ flag: checked.claim.flag, default: checked.claim.default });
	const opens = checked.opens === null ? null : Object.freeze({ field: checked.opens.field });
	const declaredStates: ReadonlySet<string> = new Set(guards.map((g) => g.state));
	const held: readonly CheckedRow[] = checked.rows;
	const rows = Object.freeze(held.map((r) => Object.freeze({ id: r.id, owner: r.owner, opens: r.opens, row: r.row as Row }))) as readonly BindingEntry<Row>[];

	/** Each guard's state value under a guard state, in the guards' order; a state the guard state omits is false. */
	const stateValues = (states: ReadonlyMap<string, boolean>): readonly boolean[] => guards.map((g) => states.get(g.state) === true);

	/** The guard state given to traceInput or matchInput, if any: omitted and undefined are the same, all states false. */
	const optionalGuardState = (fn: string, given: unknown): readonly boolean[] => (given === undefined ? guards.map(() => false) : stateValues(readGuardState(fn, given, declaredStates, "the guard state")));

	/** The context and the guard state given after the fact, each undefined when omitted, read by index from binding's own array. */
	const contextAndGuardsOf = (given: ContextAndGuards<Context>): { readonly context: unknown; readonly guardState: unknown } => {
		const list = given as readonly unknown[];
		return { context: list.length > 0 ? list[0] : undefined, guardState: list.length > 1 ? list[1] : undefined };
	};

	/** IB6's three passes: guards, then every admitted row's `on`, then every bound row's `when`. */
	function standingOf(fact: unknown, context: unknown, values: readonly boolean[]): Standing {
		const refusedBy = held.map((r) => {
			for (let k = 0; k < guards.length; k++) {
				const guard = guards[k] as BindingGuard;
				if (guardRefuses(guard, values[k] === true, r.guardFlags[k] === true)) return guard.flag;
			}
			return null;
		});
		const on: (boolean | null)[] = held.map(() => null);
		for (let i = 0; i < held.length; i++) {
			if (refusedBy[i] !== null) continue;
			on[i] = Reflect.apply((held[i] as CheckedRow).on, undefined, [fact]) ? true : false;
		}
		const when: (boolean | null)[] = held.map(() => null);
		for (let i = 0; i < held.length; i++) {
			if (on[i] !== true) continue;
			const predicate = (held[i] as CheckedRow).when;
			when[i] = predicate === null ? true : Reflect.apply(predicate, undefined, [context]) ? true : false;
		}
		return { refusedBy, on, when };
	}

	/** The indices of the rows that hit: admitted, `on` and `when` both true. */
	const hitsOf = (standing: Standing): number[] => held.flatMap((_, i) => (standing.on[i] === true && standing.when[i] === true ? [i] : []));

	const table: BindingTable<Fact, Context, Row> = {
		rows,
		guards,
		claim,
		opens,
		/** IB6: for every row, in table order, how far it matched one input. */
		traceInput(fact: Fact, ...contextAndGuards: ContextAndGuards<Context>): readonly TraceRecord[] {
			const { context, guardState } = contextAndGuardsOf(contextAndGuards);
			const standing = standingOf(fact, context, optionalGuardState("traceInput", guardState));
			return Object.freeze(
				held.map((r, i) => {
					const on = standing.on[i] as boolean | null;
					const when = standing.when[i] as boolean | null;
					return Object.freeze({ id: r.id, owner: r.owner, refusedBy: standing.refusedBy[i] as string | null, on, when, hit: on === true && when === true });
				}),
			);
		},
		/** IB7: the one row whose trace record is a hit, or none when none or several are, and whether the input is claimed. */
		matchInput(fact: Fact, ...contextAndGuards: ContextAndGuards<Context>): MatchAnswer<Row> {
			const { context, guardState } = contextAndGuardsOf(contextAndGuards);
			const standing = standingOf(fact, context, optionalGuardState("matchInput", guardState));
			const hits = hitsOf(standing);
			const match = hits.length === 1 ? (rows[hits[0] as number] as BindingEntry<Row>) : null;
			const claimed = claim !== null && held.some((r, i) => standing.on[i] === true && r.claims);
			return Object.freeze({ match, claimed });
		},
		/** IB8: every combination of the guard states, contexts and facts given -- guard states outermost -- in which two or more rows hit. */
		findOverlaps(facts: readonly Fact[], contexts: readonly Context[], guardStates: readonly GuardState[]): readonly Overlap<Fact, Context>[] {
			const factList = readArrayArgument("findOverlaps", facts, "facts");
			const contextList = readArrayArgument("findOverlaps", contexts, "contexts");
			const stateList = readArrayArgument("findOverlaps", guardStates, "guardStates");
			const values = stateList.map((state, k) => {
				if (state === undefined) throw malformed("findOverlaps", `guardStates[${k}] must be a guard state, not undefined`);
				return stateValues(readGuardState("findOverlaps", state, declaredStates, `guardStates[${k}]`));
			});
			const found: Overlap<Fact, Context>[] = [];
			stateList.forEach((state, k) => {
				for (const context of contextList) {
					for (const fact of factList) {
						const hits = hitsOf(standingOf(fact, context, values[k] as readonly boolean[]));
						if (hits.length < 2) continue;
						const ids = Object.freeze(hits.map((i) => (held[i] as CheckedRow).id));
						found.push(Object.freeze({ fact: fact as Fact, context: context as Context, guards: state as GuardState, ids }));
					}
				}
			});
			return Object.freeze(found);
		},
	};
	frozenFunction(table.traceInput);
	frozenFunction(table.matchInput);
	frozenFunction(table.findOverlaps);
	return Object.freeze({ ok: true as const, table: Object.freeze(table) });
}
