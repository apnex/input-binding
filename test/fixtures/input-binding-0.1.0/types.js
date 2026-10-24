/**
 * The public types of input-binding, one per noun of CONTRACT.md's vocabulary.
 *
 * Every type binding makes is read-only: what it returns is frozen to its depth, down to but not into the
 * caller's own values it holds -- a row, a fact, a context, a guard state -- which are returned by
 * reference and never copied, frozen or changed. The table's types are generic in the fact and the
 * context, so a consumer's predicates are typed against its own facts (IB13).
 */
export {};
//# sourceMappingURL=types.js.map