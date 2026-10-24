---
id: unminted
category: component
title: input-binding - decide what each input means in its context
status: draft
hydrate-when: More than one surface of your application must agree on what an input means, or you are about to decide click or drag, or which release ends a gesture, in a second place
sovereignty: internal
supersedes: []
related: [C0, A3]
---

# input-binding

The contract of record for input-binding at `0.2.0`: what a consumer can depend on, and every rule (`docs/DECISIONS.md`, `D2` and `D3`).\
It also carries the fields of a mission-kit registry entry, and that entry is generated from this file when the component is filed, never written as a second copy.\
The registry id is unminted on purpose; one is minted only when the entry is admitted to the registry.

---

## Duty

Decide what each input means in its context: the one declared row it matches, and the phase it makes due for the gesture in progress.

That is the whole duty.\
A gesture's phase is what an input means over time -- a move during a gesture means update, the release it accepts means commit -- so the table and the session serve one concern.\
Binding decides when each phase of a gesture is due and reports it; the application runs its own code for the phase.\
The session is the state of one input surface's presses, gestures and held keys: which release commits a gesture is that release's meaning; the keys held are the context a row needs when its meaning depends on another key held; and the order in which a press passes through the session -- made, matched, a live gesture cancelled, the start it opens -- is the session's own protocol, which it holds once (IB11, IB14, IB15).\
It does not also listen to a platform's events, find what lies under a pointer, convert coordinates, draw a preview, perform an action, hold an application's situation, or read a clock -- each of those is the consumer's or another component's.

---

## Contract

**Vocabulary.**\
These are the only nouns input-binding's source uses for what it handles.

| Word | Meaning |
|---|---|
| input | something a person did -- a key pressed, a pointer moved -- as the application hands it over |
| fact | the value an application hands binding for one input; binding reads only its `at`, its `button` and its `pointerId`, and of a key fact its `code` (IB1) |
| point | a non-null value whose `typeof` is `'object'`, so not a function, of any prototype, with finite number properties `x` and `y` |
| button | an integer naming a pointer's button, compared only for equality |
| pointer | one contact or cursor the platform tracks, named by a fact's `pointerId`, compared only for equality; a fact that names none is of the pointer `null` |
| code | a key fact's name for the physical key, a string or `null`; `''` and `null` name no physical key |
| row | a declared meaning: a record with an `id`, a predicate `on` over facts, an optional predicate `when` over contexts, flags, the gesture it opens if any, and the application's own payload |
| predicate | a pure function an application supplies, whose truthy answer means yes |
| tenant | a source of rows, named by its `owner`; tenants are composed in order |
| table | the rows of several tenants, composed once, in table order |
| context | what is true when an input arrives, as the application describes it; binding hands it to `when` unread |
| guard | a declared rule refusing rows by a state and a row's flag (IB5) |
| guard state | a record of named boolean states handed with an input |
| claim | a row's declaration that the application owns an input its `on` matches, so the platform's default action is suppressed |
| opens | the gesture a row names for a press it matches to start |
| trace | for every row of a table, in order, how far it matched one input |
| hit | a row admitted by every guard whose `on` and `when` both hold |
| match | the one hit, when there is exactly one |
| overlap | a combination of fact, context and guard state in which two or more rows hit |
| session | the state of one input surface's presses, gestures and held keys between calls, opened and owned by the application |
| press | a pointer button held: where it went down, whether it has travelled beyond the threshold, whether it is still unmatched -- not yet handed to `pressMatched`, which a press no row matches never is -- the button that began it, and the pointer that holds it |
| taken | a press the live gesture declares as its own, which then means nothing more |
| threshold | the distance a press may travel and still be a click, in the units of the facts' `at` |
| trigger | what a release is: `click` when its press never went beyond the threshold, `drop` otherwise |
| gesture | a named, declared kind of continuous interaction an application runs |
| live | the one gesture started and not yet ended |
| engaged | a gesture's declaration that, while live, it counts as a gesture in progress for the application's guards |
| phase | a step of a gesture's life binding makes due: start, update, become, commit or cancel |
| held key | a key whose code the session has seen pressed and has not seen released or lost (IB14) |
| tracked | a key fact whose code names a physical key, so the session keeps it held; a fact whose code is `''` or `null` is untracked |
| resolve | to take a press through the session in one call: made, matched by the application, a live gesture cancelled, and the start the match opens (IB15) |

**Capabilities.**\
What a consumer can depend on, one capability per row.\
A capability is named for what it offers, not for who offers it, so two components that provide the same capability share its name, and the overlap is visible.\
**Provides** means this component implements the capability.\
**Requires** names the capabilities of other components a row depends on, as `component:capability`.\
The trait column names any trait a system takes on by using the capability.

| Capability | Relation | Requires | What a consumer can depend on | Trait |
|---|---|---|---|---|
| `declared-binding-table` | provides | none | Tenants' rows, guards, a claim and the field naming what a row opens, declared as data, are composed into a table, or refused with every problem the declaration has, each naming where it lies (IB3, IB4). | none |
| `one-binding-match` | provides | none | The one row an input means in its context under a guard state, or none when none or several do -- never chosen by position -- and whether the input is claimed (IB5, IB7). | none |
| `binding-match-trace` | provides | none | For every row, in table order, how far it matched an input: refused by a guard, unbound, unmet, or a hit (IB6). | none |
| `binding-overlaps` | provides | none | Every combination, among the facts, contexts and guard states given, in which two or more rows hit (IB8). | none |
| `declared-gesture-session` | provides | none | A session opened from a threshold and the gestures an application declares, or refused with every problem (IB9). | stateful |
| `press-travel` | provides | none | Whether a press has travelled beyond the threshold, decided exactly from its moves, and whether its release is a click or a drop (IB10). | stateful |
| `live-gesture` | provides | none | The one live gesture, and which phase each input makes due for it -- start, update, commit or cancel -- by the declared gestures and the inputs alone, a chord's last release committing the gesture its button began and another pointer's move or release changing nothing, with the phases the application requests checked against the same rules (IB11, IB12). | stateful |
| `held-keys` | provides | none | The codes of the keys held, in the order first pressed, kept from each key-down, key-up and loss of focus, a key whose physical identity is unreported answered untracked, never refused (IB14). | stateful |
| `press-resolution` | provides | none | A press resolved in one call -- made, matched by the application's own code, a live gesture cancelled and the start the match opens -- the application's code running between the steps and inside the cancel (IB15). | stateful |

None requires another component's capability.\
The table keeps nothing between calls; the session keeps its state between calls for as long as its application keeps it, and so is stateful in T1's sense, which the trait column marks on the session's five rows.

**Errors.**\
Every function reads and checks its arguments in the order IB2 gives, and throws at the first that is malformed, before it reads the session's state or calls a predicate -- but the answer of `resolvePress`'s `match`, which it reads once `match` returns, after the transition before it (IB15).\
`composeBindingTable` and `openGestureSession` never throw, for any argument: they refuse with problems.\
A malformed argument to any other function throws a `TypeError` whose message begins with the function's name: a guard state not of IB5's form; `facts`, `contexts` or `guardStates` given to `findOverlaps` not of IB8's form; a fact handed to a pointer operation or a key operation not of IB1's form; a match, the answer of `resolvePress`'s `match`, or a gesture argument not of IB11's form, or naming a gesture the session does not declare; `resolvePress`'s handlers not of IB15's form.\
That beginning is the contract; the rest of a message is prose, which no consumer reads and no test pins, as in `snap-grid`, while which refusal a malformed argument meets first is fixed by IB2's order.\
An error a getter or a `Proxy` trap throws while an argument is read is rethrown as the function's own `TypeError`, its message beginning with the function's name.\
An operation the session's state does not allow -- IB11's refusals -- throws an `Error`, the base constructor, whose message begins with the operation's name, and changes nothing; a malformed argument is refused before the state is consulted, so it throws the `TypeError`.\
An exception a row's predicate throws propagates unchanged, and the call that met it returns nothing and leaves nothing behind.\
An exception `resolvePress`'s `match` or `cancelled` throws propagates unchanged, and the transitions the call made before it stand (IB15).\
Tested by: `test/contract/returned-values-and-errors.test.js` and `test/contract/press-resolution.test.js`.

**What is returned.**\
Every value binding returns -- an open result, a problem list, a table's `rows`, `guards`, `claim` and `opens`, a trace, a match, an overlap list, a session's declaration, its state, the keys held, an outcome -- is made afresh by the call that first returns it and frozen to its depth, down to but not into the caller's own values it holds.\
Those values -- a row, a fact, a context, a guard state, the match `resolvePress`'s `match` answered, handed in and handed back -- are the caller's own, returned by reference and never copied, frozen or changed.\
Every record binding makes holds its properties in the order its form is written in this section, and nothing else.\
Tested by: `test/contract/returned-values-and-errors.test.js`, and each capability's own file.

**IB1 -- The fact.**\
A fact is any value the application hands binding for one input.\
Binding reads four properties of a fact, and only of a fact handed to a session's operation:
- `at`, of a fact handed to `pointerDown`, `pointerMove` or `resolvePress`: a point, in the units the session's threshold is stated in;
- `button`, of a fact handed to `pointerDown`, `pointerUp` or `resolvePress`: a safe integer, compared only for equality with a gesture's declared button and with the press's (IB11);
- `pointerId`, of a fact handed to `pointerDown`, `pointerMove`, `pointerUp` or `resolvePress`: read by its descriptor alone -- its own keys are not read -- so a descriptor that reads `undefined` is absent and means `null`, and otherwise it must be a data property holding `null` or a safe integer, the pointer the fact is of, compared only for equality with the press's (IB10, IB11);
- `code`, of a fact handed to `keyDown` or `keyUp`: a string or `null`, the physical key the platform names, `''` or `null` when it names none (IB14).

There the fact must be a non-null value whose `typeof` is `'object'`, so not a function, of any prototype, holding each property the operation reads, `pointerId` aside, as an own data property, and is read as IB2 says; a malformed fact throws the function's own `TypeError`.\
Every other fact, every fact handed to a table, and every other property of any fact, binding passes unread and unchanged to the predicates the application declared, and never keeps, copies, freezes or writes.\
So the shape of a fact -- its kind, its key, its modifiers, what lies under it -- is the application's and its rows', never binding's: a table may name the application's own outcomes as facts, since a fact is any value the application hands.\
A listener such as `input-capture` makes facts of this shape, `at`, `button`, `pointerId` and `code` among their fields, and binding gives one thing back for it to act on, `claimed` (IB7).\
Tested by: `test/contract/argument-reading.test.js` (I8).

**IB2 -- How arguments are read.**\
These rules, `snap-grid`'s where they fit, decide every reading the contract makes:
1. A plain object is a value whose prototype is `Object.prototype` or `null`; an array is a value for which `Array.isArray` is true and whose prototype is `Array.prototype`; a transparent `Proxy` cannot be told from its target, and is read as its target, its traps running as rule 9 says.
2. Every argument binding reads but a point -- a declaration, a guard state, a match handed to `pressMatched`, the answer of `resolvePress`'s `match`, a gesture argument, `resolvePress`'s handlers, and a fact handed to a session's operation -- is read through its own data properties, by descriptor, so no getter of it is called: an own accessor property is present and of no form, an inherited property is absent, and a symbol-named property is ignored.
3. Present means an own property, whatever its value; a property present with the value `undefined` is present, and of no form, since no form admits `undefined`; an optional argument -- the `guards` of `traceInput` and `matchInput`, a predicate's context -- omitted and one given as `undefined` are the same.
4. An array is of its form only when it is dense -- every index from 0 to `length - 1` an own data property -- and holds no own string-named property but those indices and `length`.
5. A point -- a fact's `at`, a gesture argument's `from` -- and a fact handed to a session's operation are each a non-null value whose `typeof` is `'object'`, so a function is neither, of any prototype; a point's `x` and `y` are read once each through ordinary property access, `x` first, so a point whose `x` and `y` are getters on its prototype answers -- a browser's `DOMPoint` is one, as a point a page converts from the screen with `matrixTransform` is -- and both are read before either is checked, as `snap-grid` reads a point.
6. Reflection that throws -- `Array.isArray`, or reading a prototype, own keys, a descriptor or a point's coordinate, on a revoked or trapping `Proxy` or through a throwing getter -- makes that value of no form: in a declaration it is refused at its pointer (IB3); in any other argument it is malformed.
7. A property binding does not own -- a row's payload, a match's `owner` and `row`, a fact's every property but `at`, `button`, `pointerId` and `code` -- is never read, so its getter never runs, whatever its form, and it may be an accessor or hold `undefined`.
8. A declaration is read whole, value by value, in the table's order: of each value, first all that judges it at its own pointer -- its prototype, for an array `Array.isArray` first, then its own keys, then the descriptor of each property its form names that its own keys hold, in the table's order, or for an array the descriptor of its `length` and then of each index in order -- and only then, unless it is refused at its pointer, the values those descriptors held, in the same order, each read whole before the next; a property its form does not name is known by its key alone, nothing beneath a value refused at its pointer is read, nothing is read twice, and every problem is reported (IB3, IB9); every other function reads its arguments once each, in the table's order, an array as a declaration's is read, checking each read as it is made -- a point's `x` and `y` together -- and throws at the first that is malformed, reading nothing after it.
9. A point's getter and a `Proxy`'s trap -- `getPrototypeOf`, `ownKeys`, `getOwnPropertyDescriptor`, `get` and the rest -- are the application's code, and may call the session: what that call does takes effect at once; the operation reading the argument reads the session's state only after all its arguments are read and checked, so it sees what that code left; an operation that throws while reading changes nothing itself, and undoes nothing that code did, whether the code returned or threw; and binding cannot tell a `Proxy` from its target, no means to do so being common to every runtime, so it can neither refuse one nor keep its traps from running, and it calls a getter only on a point, where a browser's `DOMPoint` needs one.

| Function | What it reads, in order |
|---|---|
| `composeBindingTable` | the declaration; its `guards`, each guard's `state`, `flag`, `default` and `refuses`; its `claim`'s `flag` and `default`; its `opens`'s `field`; its `tenants`, each tenant's `owner` and `rows`, and each row's `id`, `on` and `when`, then, when step 9 runs, each guard's flag in order, the claim's flag and the `opens` field |
| `openGestureSession` | the declaration; its `threshold`; its `gestures`, each gesture's `name`, `engaged` and `button` |
| `matchInput`, `traceInput` | the guard state, if given: its prototype, its own keys, then each own string-named property's descriptor in the order `Reflect.ownKeys` gives them; the fact and the context are never read |
| `findOverlaps` | `facts`, then `contexts`, then `guardStates`, each array as rule 8 reads one -- `Array.isArray`, its prototype, its own keys, its `length`'s descriptor and its elements' in index order; then each element of `guardStates` in order, as a guard state |
| `pointerDown` | the fact; its `at`; that point's `x` and `y`; the fact's `button`; its `pointerId` |
| `pointerMove` | the fact; its `at`; that point's `x` and `y`; its `pointerId` |
| `pointerUp` | the fact; its `button`; its `pointerId` |
| `pressMatched` | the match's prototype; its `id`; its `opens` |
| `startGesture`, `becomeGesture` | the argument's prototype and own keys; its `gesture`, then its `row` for `startGesture`, then its `from`, each by descriptor; then that point's `x` and `y` |
| `pointerLost`, `cancelGesture` | nothing |
| `resolvePress` | the fact, as `pointerDown`; then `handlers` as `startGesture` reads its argument -- prototype, own keys, then the descriptors of `match` and `cancelled` its own keys hold; later, `match`'s answer as `pressMatched` reads a match -- prototype, `id`, `opens` -- `undefined` among the answers refused |
| `keyDown`, `keyUp` | the fact; its `code` |
| `keysLost` | nothing |

So a declaration whose `gestures` descriptor trap rewrites `threshold` has already had `threshold` read; a `guards` array whose second element is an accessor is refused before its first element is read, so no trap of that element runs; `pointerDown` given an accessor `at` throws with no getter called; a point whose `x` is `NaN` has its `y` read and then throws; and `startGesture` naming a gesture the session does not declare throws before `from`'s coordinates are read; a fact's `pointerId` is read only after its `button`, so a malformed `button` leaves it unread; and `resolvePress` reads none of its handlers when its fact is malformed.\
Tested by: `test/contract/declared-binding-table.test.js`, `test/contract/declared-gesture-session.test.js`, `test/contract/one-binding-match.test.js`, `test/contract/binding-overlaps.test.js`, `test/contract/argument-reading.test.js` and `test/contract/press-resolution.test.js`, each holding its functions' order with a `Proxy` that records each trap.

**IB3 -- A table, composed or refused.**\
`composeBindingTable(declaration)` returns `{ ok: true, table }` or `{ ok: false, problems }`.\
A declaration is a plain object holding `tenants` and, optionally, `guards`, `claim` and `opens`:
- `tenants`, an array, each tenant a plain object of exactly `owner`, a non-empty string, and `rows`, an array; two tenants may share an owner;
- `guards`, an array, each guard a plain object of exactly `state`, `flag`, `default` and `refuses` (IB5);
- `claim`, a plain object of exactly `flag` and `default` (IB7);
- `opens`, a plain object of exactly `field`, the name of the row property in which a row names the gesture a press it matches opens (IB11).

A row is a plain object holding `id`, a non-empty string, and `on`, a function; optionally `when`, a function; optionally, for each guard and for the claim, a property named by its `flag`, a boolean; optionally a property named by `opens.field`, a non-empty string; and any other property, which the table never reads.\
A problem is a record `{ pointer, problem }`: an RFC 6901 pointer into the declaration (`~` written `~0`, `/` written `~1`), and one of the codes below.\
Problems are ordered by pointer and then by problem, each compared by UTF-16 code unit as JavaScript's `<` compares strings, and no record appears twice.\
A check that fails at a pointer suppresses every check beneath that pointer, and none at a sibling's; a member is valid when no problem lies at its pointer or beneath it.\
Where a step needs a plain object and finds anything else -- a value of another kind, an accessor, a value whose reflection throws -- the problem is `not-an-object`; where it needs an array or a value of another form and finds anything else, `invalid-value`; an array that is not dense, or holds another own string-named property, is `invalid-value` at its own pointer, and nothing beneath it is checked.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `tenants`, `guards`, `claim` and `opens`; `tenants` absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/tenants` |
| 3 | `guards` present and not an array of its form; a guard not a plain object; a guard property other than its four, or one of them absent; `state` or `flag` not a non-empty string, or `flag` one of `id`, `on`, `when`; `default` not a boolean; `refuses` not one of the three forms of IB5 | `invalid-value` at `/guards`; `not-an-object` at `/guards/<k>`; `unknown-property` or `missing-property` at `/guards/<k>/<name>`; `invalid-value` at `/guards/<k>/<name>` |
| 4 | `claim` present and not a plain object; a property other than `flag` and `default`, or one absent; `flag` not a non-empty string, or one of `id`, `on`, `when`; `default` not a boolean | `not-an-object` at `/claim`; `unknown-property` or `missing-property` at `/claim/<name>`; `invalid-value` at `/claim/<name>` |
| 5 | `opens` present and not a plain object; a property other than `field`, or `field` absent; `field` not a non-empty string, or one of `id`, `on`, `when` | `not-an-object` at `/opens`; `unknown-property` or `missing-property` at `/opens/<name>`; `invalid-value` at `/opens/field` |
| 6 | among the row-property names the declaration gives -- each guard's `flag` in order, then the claim's `flag`, then `opens.field` -- each valid at its own pointer whatever its siblings, one equal to an earlier one | `duplicate-field` at the later one's pointer |
| 7 | `tenants` not an array of its form; a tenant not a plain object; a tenant property other than `owner` and `rows`, or one absent; `owner` not a non-empty string; `rows` not an array of its form | `invalid-value` at `/tenants`; `not-an-object` at `/tenants/<i>`; `unknown-property` or `missing-property` at `/tenants/<i>/<name>`; `invalid-value` at `/tenants/<i>/<name>` |
| 8 | a row not a plain object; `id` or `on` absent; `id` not a non-empty string; `on` not a function; `when` present and not a function | `not-an-object` at `/tenants/<i>/rows/<j>`; `missing-property` at `.../<j>/id` or `.../<j>/on`; `invalid-value` at `.../<j>/<name>` |
| 9 | no problem lies at or beneath `/guards`, `/claim` or `/opens` -- a `duplicate-field` of step 6 among them -- and a row holds a guard's or the claim's flag that is not a boolean, or the `opens` field that is not a non-empty string, `undefined` among them | `invalid-value` at `/tenants/<i>/rows/<j>/<name>` |
| 10 | among rows whose `id` is valid, in table order, one whose `id` equals an earlier row's | `duplicate-id` at the later row's `/id` |

A row's `id`, `on` and `when` are checked at step 8 alone, and a row's properties are checked only under the names steps 8 and 9 give, so a payload property is never inspected.\
Tested by: `test/contract/declared-binding-table.test.js` (I1).

**IB4 -- What a table holds.**\
Table order is the tenants in the declaration's order, each tenant's rows in its order.\
At composition the table reads each row's `id`, `on`, `when`, declared flags and `opens` field, once, and holds them with the row's owner, a flag the row omits taking its declared `default`; it reads no other property of a row, then or later.\
So a row changed after composition changes no answer; the row object itself is kept by reference, and is handed back as `row` wherever an entry or a match names it, so the application reads its own payload from it.\
`table.rows` is a frozen array, in table order, of frozen entries `{ id, owner, opens, row }`, in that order whatever the declaration: `opens` is the row's gesture name, or `null` for a row with no own property of the `opens` field's name and for every row when no `opens` is declared; a row holding that property with any other value, `undefined` among them, is refused at IB3 step 9.\
`table.guards` is a frozen array of frozen copies `{ state, flag, default, refuses }`, in order; `table.claim` a frozen copy `{ flag, default }`, or `null`; `table.opens` a frozen copy `{ field }`, or `null`.\
A table holds no state and changes after composition in no way; any number of callers may share one.\
Tested by: `test/contract/declared-binding-table.test.js` (I2).

**IB5 -- Guards.**\
A guard state is a plain object whose own properties are named states, each a boolean data property; a state it omits is `false`, and an omitted guard state is all states `false`.\
A guard state naming a state no guard of the table declares, holding a value that is not a boolean, or holding an accessor, is malformed.\
A guard `{ state, flag, default, refuses }` refuses a row, under a guard state, as `refuses` says, `s` being the guard state's value of `state` and `f` the row's value of `flag`:

| `refuses` | The row is refused when |
|---|---|
| `state-and-flag` | `s` and `f` |
| `state-without-flag` | `s` and not `f` |
| `flag-without-state` | `f` and not `s` |

A row is admitted when no guard refuses it.\
Several guards may name one state; no two name one flag (IB3 step 6).\
Tested by: `test/contract/one-binding-match.test.js` (I3).

**IB6 -- The trace.**\
`table.traceInput(fact, context, guards?)` returns a frozen array of frozen records `{ id, owner, refusedBy, on, when, hit }`, one per row, in table order, computed in three passes:
1. each row's guards are applied, and `refusedBy` is the `flag` of the first guard, in declaration order, that refuses it, or `null` when it is admitted;
2. for each admitted row, in table order, its `on` is called once with the fact;
3. for each admitted row whose `on` answered a truthy value, in table order, its `when`, if it has one, is called once with the context.

`on` is `null` for a refused row and otherwise whether its call answered a truthy value; `when` is `null` for a row pass 3 does not reach, `true` for a reached row with no `when`, and otherwise whether its call answered a truthy value; `hit` is `true` exactly when `on` and `when` are both `true`.\
So each record reads as refused, unbound (`on` false), unmet (`when` false) or a hit.\
A predicate is called with no receiver and one argument, as `Reflect.apply(predicate, undefined, [argument])` calls it -- so a strict function sees `this` undefined, a sloppy one the global object, and a bound or arrow function its own -- and its answer is taken as JavaScript's `if` takes it.\
Predicates are the application's, expected to be pure functions of their argument; binding calls each at most once in a call of `traceInput` or `matchInput`, and at most once for each combination in a call of `findOverlaps`, in the order above, and cannot detect a predicate that is not pure.\
Tested by: `test/contract/binding-match-trace.test.js` (I6).

**IB7 -- One match, or none.**\
`table.matchInput(fact, context, guards?)` returns a frozen `{ match, claimed }`, from exactly the calls IB6 makes for the same arguments:
- `match` is a frozen `{ id, owner, opens, row }` -- as the row's entry in `table.rows` -- for the one row whose trace record is a hit, or `null` when no row hits or more than one does;
- `claimed` is `true` when some admitted row whose `on` answered a truthy value holds its claim flag `true` -- whatever its `when` answered -- and `false` otherwise, always `false` for a table with no claim.

So no permutation of tenants or of rows changes a `matchInput` answer's `match.id` or `claimed`; order decides only the order of `rows`, of a trace and of an overlap list.\
Tested by: `test/contract/one-binding-match.test.js` (I4, I5).

**IB8 -- Overlaps.**\
`table.findOverlaps(facts, contexts, guardStates)` takes three arrays of IB2's form; the elements of `facts` and `contexts` may be any values, `undefined` among them, and every element of `guardStates` must be a guard state (IB5), so an `undefined` element is malformed there.\
All three are read and checked before any predicate is called, even when one is empty.\
For each guard state, then each context, then each fact -- guard states outermost, facts innermost -- it makes the calls IB6 makes, and where two or more rows hit it lists a frozen record `{ fact, context, guards, ids }`: the three values given, by reference, and `ids`, a frozen array of the hitting rows' ids in table order.\
It returns a frozen array of the records in that order, empty when there is none.\
Tested by: `test/contract/binding-overlaps.test.js` (I7).

**IB9 -- A session, opened or refused.**\
`openGestureSession(declaration)` returns `{ ok: true, session }` or `{ ok: false, problems }`, problems and their reading as IB3 states them.\
A declaration is a plain object of exactly `threshold` and `gestures`:
- `threshold`, a finite number at least 0: the distance a press may travel and still be a click, in the units of the facts' `at`;
- `gestures`, an array of plain objects of exactly `name`, a non-empty string, unique among them; `engaged`, a boolean; and `button`, a safe integer or `null` -- the button whose presses the gesture takes while it is live, and the only button whose release commits it, or `null` for a gesture that takes no press and is committed by any release.

| Step | When | Problem, at pointer |
|---|---|---|
| 1 | the declaration is not a plain object | `not-an-object` at `""`, and nothing else |
| 2 | an own property other than `threshold` and `gestures`; one of them absent | `unknown-property` at `/<name>`, one each; `missing-property` at `/<name>` |
| 3 | `threshold` not a finite number at least 0 | `invalid-value` at `/threshold` |
| 4 | `gestures` not an array of its form; a gesture not a plain object; a property other than `name`, `engaged` and `button`, or one absent; `name` not a non-empty string; `engaged` not a boolean; `button` neither a safe integer nor `null` | `invalid-value` at `/gestures`; `not-an-object` at `/gestures/<k>`; `unknown-property` or `missing-property` at `/gestures/<k>/<name>`; `invalid-value` at `/gestures/<k>/<name>` |
| 5 | among valid names, one equal to an earlier one | `duplicate-name` at the later one's `/name` |

`session.declaration` is a frozen copy `{ threshold, gestures }`, each gesture `{ name, engaged, button }`, `-0` written `0`.\
A session belongs to the application that opens it: one for each input surface whose presses, gestures and keys form one stream, kept as long as the application keeps it, and dropped by dropping it; two sessions share nothing.\
Tested by: `test/contract/declared-gesture-session.test.js` (I1).

**IB10 -- The press.**\
A session holds at most one press, `null` or `{ at, beyond, unmatched, button, pointer }`:
- `pointerDown(fact)` replaces the press, whatever press there was: `at` a copy of the fact's, `beyond` false, `unmatched` true unless the live gesture takes the press (IB11), when it is false, `button` the fact's, written `button + 0`, and `pointer` its `pointerId`, written likewise, or `null` when it names none;
- `pointerMove(fact)` of the press's own pointer makes the press beyond when it is not yet beyond and the distance from its `at` to the fact's `at` is greater than the threshold, and then its outcome's `crossed` is `true`; otherwise the press is unchanged and `crossed` is `false`; a move with no press changes no press, and a move of another pointer changes nothing (IB11);
- `pointerUp(fact)` of the press's own pointer, or with no press, answers `trigger`, `'drop'` when there is a press and it is beyond and `'click'` otherwise, and makes the press `null`; it reads the fact's `button` and `pointerId` (IB11), never its `at`, so where a release lands never counts, only the moves before it; a release of another pointer changes nothing, its `trigger` `null`;
- `pointerLost()` makes the press `null`, with no trigger -- the platform has taken the pointer;
- `pressMatched` answering `start` or no phase makes `unmatched` false (IB11);
- `startGesture` and `becomeGesture` given `from`, when there is a press, set its `at` to a copy of `from` and `beyond` to false, keeping `unmatched`, `button` and `pointer`; with no press, `from` is read and checked and changes nothing.

So a restart never changes the button that began the press, which decides a chord's release (IB11), nor the pointer that holds it.

The distance is decided exactly: with `(x0, y0)` the press's `at`, `(x1, y1)` the fact's and `t` the threshold, the press is beyond when `(x1 - x0)^2 + (y1 - y0)^2 > t^2` holds of the exact real numbers the binary64 values denote.\
So a travel of exactly the threshold is a click, and a press never stops being beyond except by a new press, a restart, `pointerUp` or `pointerLost`.

It is computed exactly, and cheaply, in two steps:
1. **A binary64 filter.** With `dx = x1 - x0`, `dy = y1 - y0`, `s = dx * dx + dy * dy` and `q = t * t`, each rounded once, and every one of `dx`, `dy`, `s` and `q` finite, and each of `dx * dx`, `dy * dy` and `q` either `0` because its operand is `0` or at least 2^-1022: the press is beyond when `s > q * (1 + 2^-49)`, and not beyond when `s < q * (1 - 2^-49)`.
2. **An exact fallback.** Otherwise the five values are read as their exact significands and exponents, shifted as `BigInt`s to the least exponent among the nonzero ones, and compared exactly.

The filter is sound: a subtraction whose result is subnormal is exact, and otherwise errs by at most one rounding, `u = 2^-53` relative; so, with no underflow, the computed `s` lies within a factor `1 +- 5u` of the exact sum and the computed `q` within `1 +- u` of `t^2`, and a computed `s` above `q * (1 + 2^-49)` -- 2^-49 being `16u` -- implies an exact sum above `t^2`, and below `q * (1 - 2^-49)` one below it, the one further rounding that forms each bound being absorbed by the margin between `5u` and `16u`.\
The fallback is bounded: the exponents of the last places of finite binary64 values run from -1074 to 971, so each shifted operand has at most 2,098 bits, each difference 2,099 and each square 4,198, which `BigInt` multiplies in microseconds -- 16 to 26 microseconds were measured at the worst case, two coordinates near `Number.MAX_VALUE` of opposite signs against one at `Number.MIN_VALUE` -- and the filter decides every travel of ordinary magnitude that does not lie within a relative 2^-49 of the threshold, so the fallback runs only at the edge and at extremes.\
This repository's tests hold the fallback to an oracle that shares no code with it, over random travels and over cases built so the filter cannot decide them, and each of five mutations of the fallback fails the built cases (I9).\
Tested by: `test/contract/press-travel.test.js` (I9).

**IB11 -- The live gesture, and what makes each phase due.**\
A session holds at most one live gesture, `null` or `{ name, row, engaged }`, `row` the id of the row that opened it or `null`.\
A gesture lives from the operation that starts it to the one that ends it, a commit or a cancel; `becomeGesture` renames it within the same life.\
Each operation answers the phase it makes due -- `start`, `update`, `become`, `commit`, `cancel`, or `null` for none -- and the gesture it concerns (IB12).

**Inputs.**\
These five operations take what a person did, and binding decides from them and from the declared gestures which phase is due, `g` being the live gesture's declared button and `p` the press:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `pointerDown(fact)` | a gesture is live and declares a `button` equal to the fact's | none: the press is taken -- replaced, with `unmatched` false, and the outcome's `taken` true -- and means nothing more |
| `pointerDown(fact)` | otherwise | none: the press is replaced, `unmatched` true, `taken` false |
| `pressMatched(match)` | the press is unmatched, and a gesture is live | `cancel`: a press that means something ends the gesture in progress; the press stays unmatched, so the start it opens can follow |
| `pressMatched(match)` | the press is unmatched, none is live, and `match.opens` names a gesture | `start`: that gesture is live, its `row` `match.id`; the press is no longer unmatched |
| `pressMatched(match)` | the press is unmatched, none is live, and `match.opens` is `null` | none: the press means an action, the application's; the press is no longer unmatched |
| `pressMatched(match)` | there is no press, or it is not unmatched | refused (Errors) |
| `pointerMove(fact)` or `pointerUp(fact)` | `p !== null` and the fact's `pointerId` `!== p.pointer` | none: nothing changes; the outcome's `otherPointer` `true`, `crossed` `false`, `trigger` `null` |
| `pointerMove(fact)` | otherwise, a gesture is live | `update`, the press's travel decided as IB10 says |
| `pointerMove(fact)` | otherwise | none, the press's travel decided as IB10 says |
| `pointerUp(fact)` | otherwise, a gesture is live, and `g === null`, or `g === fact.button`, or `p !== null && g === p.button` | `commit`: the gesture ends; the press ends with its trigger |
| `pointerUp(fact)` | otherwise | none: the press ends with its trigger, and a live gesture stays live |
| `pointerLost()` | a gesture is live | `cancel`: the gesture ends; the press ends |
| `pointerLost()` | none is live | none: the press ends |

A move or a release whose fact's `pointerId` is absent is of the pointer `null`, so a sequence of facts that name no pointer is of one pointer throughout; `otherPointer` is `false` for every move and release but another pointer's.\
While the press holds a pointer that is not `null`, a fact naming none is another pointer's, so name `pointerId` on every pointer fact or on none.\
A platform delivers a chord's presses and releases after the first as moves, so the release that ends a press names the last button released, which need not be the button that began it (measured in Chrome: `pointerdown` 0, `pointermove` 2, `pointermove` 0, `pointerup` 2); that release commits a gesture the press's button began.\
A second pointer's press still replaces the first's: what changes is that the first pointer's later moves and release no longer move, end or commit the press the second began.\
The cases the rule decides, with gestures `g0` and `g3` declaring buttons 0 and 3 and `gnull` declaring `null`, facts carrying no `pointerId` but in the last row, beside what `0.1.0` answered:

| Sequence | `0.1.0` | `0.2.0` |
|---|---|---|
| `down` 0 opening `g0`; `up` 0 | commit | commit |
| `down` 0 opening `g0`; the right button pressed and the left released, as moves; `up` 2 | none, `g0` left live | commit: `g0` is the press's button |
| `down` 0 opening `g0`; the right button pressed and released, as moves; `up` 0 | commit | commit |
| `down` 3 opening `g3`; the left button pressed and button 3 released, as moves; `up` 0 | none, `g3` left live | commit |
| `g0` started with no press; `down` 3, not taken; `up` 0 | commit: the release names 0 | commit |
| `g0` started with no press; `down` 3; `up` 3 | none, `g0` live | none, `g0` live |
| `g0` started with no press; `down` 0, taken; `up` 0 | commit | commit |
| `gnull` started; `down` 2; `up` 2 | commit | commit |
| `down` 0 of pointer 7 opening `g0`; `up` 2 of pointer 1 | none, the press ended | none, nothing changed, `otherPointer` `true` |

`pressMatched` takes the `match` of a `matchInput` answer, read by IB2: a plain object holding `id`, a non-empty string, and `opens`, a name the session declares or `null`; its other properties are not read.\
A press that matched no row is never handed to `pressMatched`, and changes nothing of the gesture.\
An application that resolves a press calls `pressMatched` once, and again only when it answered `cancel`, for the start the match opens -- or calls `resolvePress`, which holds that order once (IB15).

**Requests.**\
These three operations are the application's, for causes binding cannot see; binding checks each against the same rules and reports the phase it makes due:

| Operation | When | Phase due, and what changes |
|---|---|---|
| `startGesture({ gesture, row?, from? })` | none is live | `start`: the gesture is live, `row` the string given or `null`; a held press restarts from `from` (IB10) |
| `startGesture(args)` | one is live | refused |
| `becomeGesture({ gesture, from? })` | one is live | `become`: it takes the new name and that gesture's `engaged`, keeps its `row`, and the outcome's `was` is the gesture as it was; a held press restarts from `from` |
| `becomeGesture(args)` | none is live | refused |
| `cancelGesture()` | one is live | `cancel`: the gesture ends |
| `cancelGesture()` | none is live | none |

A gesture argument is a plain object read by IB2: `startGesture`'s holds `gesture`, a name the session declares, and optionally `row`, a non-empty string, and `from`, a point; `becomeGesture`'s holds `gesture` and optionally `from`; any other property, `row` given to `becomeGesture` among them, is malformed.\
So `row` present with any value but a non-empty string -- `null` and `undefined` among them -- is malformed, and only a `row` absent leaves the gesture's `row` `null`; and a call with no argument, or with any value that is not a plain object, is malformed.\
They are requests because their causes are the application's state, not an input: which gesture a chain opens with no press, and when; what a gesture becomes once its press is a drag, which an application decides by its own table and by whether anything selected can move; and a cancel for a lock, a document replaced, a key's action, or a become that found nothing to do.\
A `becomeGesture` given `from` restarts the press from that point, not beyond (IB10), so a drag that becomes another gesture with `from` turns its release into a click; a drag that must stay a drop becomes another gesture without `from`.\
So binding still decides when each phase is due: from the inputs it is given, by the rules above, and for every request by refusing it unless the lifecycle allows it now; the application runs its code for a phase only on an outcome naming it.\
A gesture's working data is the application's, and binding holds none of it: the live gesture is a name, a row and `engaged`.\
So what the application does to that data between phases -- a key redrawing a preview, or adding a stop to it -- is no phase, and changes the session only through a request.

**Lives.**\
At most one gesture is live; each life ends at most once, by a `commit` or a `cancel`; and at every moment the gestures started equal the gestures ended plus the one live, if any.\
Nothing else ends a gesture: a session dropped with one live ends nothing and reports nothing, and a gesture opened with no press stays live until an input or a request ends it, so seeing every gesture end is the application's obligation -- on a release, a lost pointer, a press, a focus lost, or its own causes.

The phases are these: start, by `pressMatched` or `startGesture`; update, by `pointerMove`; commit, by `pointerUp`; cancel, by `pointerLost`, `pressMatched` or `cancelGesture`; and become, a renaming within one life.\
Tested by: `test/contract/live-gesture.test.js` (I10, I11, I15, I18), and beside `0.1.0` by `test/compatibility/beside-0.1.0.test.js` (I19).

**IB12 -- State, identity and outcomes.**\
`session.state` is a frozen `{ press, gesture, keys }`, in that order: `press` and `gesture` each `null` or the record IB10 and IB11 name, `press.at` a frozen `{ x, y }`, and `keys` the frozen array of the codes held (IB14).\
Every coordinate, button and pointer binding copies is written `v + 0`, so no state holds `-0`.\
An operation computes the press, the gesture and the keys it leaves; the press and the gesture are each the very same record as before when every field equals the old one's under `===` -- a press's `at` compared by its `x` and its `y` -- and a new frozen record otherwise; the press's `at` is likewise the very same record when its `x` and `y` are equal; `keys` is the very same array when no code changed; and the state is the very same value when all three are, and a new frozen `{ press, gesture, keys }` otherwise.\
So `pointerDown` at the press's own point while it is not beyond, with an equal `unmatched`, `button` and `pointer`, a restart from the press's own point while it is not beyond, `becomeGesture` to the live gesture's own name with no restart, and every operation that changes nothing leave the very same state; and a `pointerDown` that differs from the press in its button or its pointer alone leaves a new press and state.\
A session is a frozen object of exactly `declaration`, `state`, `pointerDown`, `pressMatched`, `pointerMove`, `pointerUp`, `pointerLost`, `startGesture`, `becomeGesture`, `cancelGesture`, `resolvePress`, `keyDown`, `keyUp` and `keysLost`, in that order.\
Each operation answers a fresh frozen outcome, of the form the table gives: `state` the state it leaves, `phase` the phase it made due or `null`, and `gesture` the record the phase concerns -- the gesture started, updated or become, or the one that ended -- and `null` when `phase` is `null`:

| Operation | Outcome |
|---|---|
| `pointerDown(fact)` | `{ state, phase, gesture, taken }`, `taken` a boolean, `phase` and `gesture` always `null` |
| `pressMatched(match)` | `{ state, phase, gesture }` |
| `pointerMove(fact)` | `{ state, phase, gesture, crossed, otherPointer }`, `crossed` and `otherPointer` booleans |
| `pointerUp(fact)` | `{ state, phase, gesture, trigger, otherPointer }`, `trigger` `'click'`, `'drop'`, or `null` for another pointer's release; `otherPointer` a boolean |
| `pointerLost()`, `startGesture(args)`, `cancelGesture()` | `{ state, phase, gesture }` |
| `becomeGesture(args)` | `{ state, phase, gesture, was }`, `was` the gesture as it was |
| `resolvePress(fact, handlers)` | `{ state, taken, match, cancelled, phase, gesture }` (IB15) |
| `keyDown(fact)`, `keyUp(fact)` | `{ state, tracked, held }` (IB14), no phase |
| `keysLost()` | `{ state, released }` (IB14), no phase |

For arguments whose reading runs no application code -- no `Proxy` among them, and every point's `x` and `y` data properties or getters that answer the same at every read, as a `DOMPoint`'s do -- the same declaration and the same sequence of operations and arguments give the same states and outcomes.\
Where reading does run application code, an operation's outcome is decided by what its reads answered and by the calls into the session that code made, in IB2's order; binding cannot make a getter or a trap answer the same twice, and promises nothing of one that does not.\
A session calls no application code but a point's getters and a `Proxy`'s traps while it reads its arguments, all before it reads its own state, and `resolvePress`'s `match` and `cancelled`, each after the transition before it, the state read again after each returns (IB15); it keeps nothing of a fact but a copy of its `at`, its `button` and its `pointerId`, and of a key fact its `code` while the key is held; so any operation may be called from code the application runs in answer to another operation's outcome -- a commit body starting a chained gesture -- and sees the state the last operation left.\
Tested by: `test/contract/live-gesture.test.js` (I12), `test/contract/held-keys.test.js` and `test/contract/press-resolution.test.js`.

**IB13 -- Exports.**\
`@apnex/input-binding` exports `composeBindingTable` and `openGestureSession`, and nothing else; it has no subpath.\
The package imports no other package and no module particular to one runtime, touches no DOM, reads no clock and no randomness, and holds no timer, so the same files run in Node.js and in a browser.\
Its TypeScript declarations are generic in the fact and the context, so a consumer's predicates are typed against its own facts, and generic in the match `resolvePress`'s `match` answers; among the session's types they export `KeyOutcome`, `KeysLostOutcome`, `ResolvePressHandlers` and `ResolvePressOutcome`, and `KeyFact`, the fact the key operations read.\
Tested by: `test/contract/public-surface.test.js`, `test/contract/public-types.test.js` (the declarations, compiled from `test/types/`), the runtime check (`tools/check-runtime.mjs`), the clock and chance check (`tools/check-clock-and-chance.mjs`) and the consumer test (`tools/consumer-test.mjs`).

**IB14 -- Held keys.**\
Three operations take what the key source delivered, and `session.state` holds `keys`, a frozen array of the codes held, in the order first pressed:

| Operation | What changes, and the outcome |
|---|---|
| `keyDown(fact)` | a non-empty `code` not held is appended; the outcome `{ state, tracked, held }`: `tracked` false when `code` is `''` or `null`, the state then unchanged and `held` `null`; otherwise `held` true when the code was held already -- a repeat, or a press whose release was not seen |
| `keyUp(fact)` | a non-empty `code` held is removed; the outcome `{ state, tracked, held }`: `tracked` as for `keyDown`; otherwise `held` false when the code was not held -- a key pressed while the page lacked focus |
| `keysLost()` | every code removed; the outcome `{ state, released }`, `released` the array `state.keys` held before the call, the very same value, so the empty array itself when nothing was held |

So a key whose physical identity the platform does not report is neither refused nor given one: `key` is never read in its place.\
The keys held never change the press or the gesture, and no key operation makes a phase due.\
IB12's identity holds: `keys` is the very same array when no code changed, and the state the very same value when nothing did.\
An application calls `keysLost` when its key source loses focus, since no release is promised to reach a page that has lost it.\
Tested by: `test/contract/held-keys.test.js` (I16).

**IB15 -- A press resolved in one call.**\
`session.resolvePress(fact, handlers)` takes a press through the session in one call, `handlers` holding `match`, a function, and optionally `cancelled`, a function; any other property is malformed.\
*The press* is the one step 2 makes, until a `pointerDown`, `pointerUp`, `pointerLost` or `resolvePress` replaces or ends it; a move or a restart keeps it.
1. It reads its arguments (IB2); a malformed one throws the function's own `TypeError`, the state untouched.
2. It makes `pointerDown`'s transition; when the press is taken, it answers at once, `match` never called.
3. It calls `match` with no receiver and no argument, and reads its answer once: `null` ends the call, the press left unmatched, as a press that matched no row is; any other answer is read as a match, a malformed one, `undefined` among them, throwing the function's own `TypeError` with the `pointerDown` transition standing; the `id` and `opens` read decide every later transition, whatever a callback later does to the match.
4. It makes `pressMatched`'s transition when the press is still unmatched, and otherwise ends the call.
5. When that answers `cancel`, it calls `cancelled`, if given, with that outcome and no receiver, then makes `pressMatched`'s transition once more when the press is still unmatched and no gesture is live, and otherwise ends the call.
6. It answers a fresh frozen `{ state, taken, match, cancelled, phase, gesture }`: `taken` as `pointerDown` answered; `match` the value `match` answered, or `null`; `cancelled` step 5's `cancel` outcome, or `null`; `phase` and `gesture` the press's resolution -- `start` and the gesture started, or `null` -- never `cancel`, which `cancelled` alone reports.

| While | A callback | Then |
|---|---|---|
| `match` runs | calls nothing of the session | step 4 |
| `match` runs | ends, replaces or matches the press | no transition; `phase` `null` |
| `match` runs | starts a gesture, the press still unmatched | step 4, whose `cancel` ends that gesture and calls `cancelled` |
| `cancelled` runs | calls nothing of the session | the second transition: `start` or `null` |
| `cancelled` runs | ends, replaces or matches the press, or starts a gesture | no second transition; `phase` `null` |
| either runs | throws | the error propagates; the transitions made stand |

So a call cancels at most one gesture, and only one `cancelled` saw.\
The two traps this order holds -- `pressMatched` throws on a taken press, and a cancel without a second call loses the start -- are the session's to hold once, and an application's code runs where its policy sits: between the press and the match, and inside the cancel.\
A typical `match` asks the table, `() => table.matchInput(fact, context, guards).match`, and the application acts on the outcome's `phase` as it would on `pressMatched`'s.\
Tested by: `test/contract/press-resolution.test.js` (I17).

**Invariants.**\
There is no conformance kit: nothing in input-binding is a port another party implements.\
*input-binding* marks what the component's own tests hold; *gate* what its gate holds.

| # | Invariant | Held by |
|---|---|---|
| I1 | `composeBindingTable` and `openGestureSession` never throw for any value, and answer every declaration with exactly the problems IB3 and IB9 give, from a table of cases: escaped pointers, code-unit order, present `undefined`, accessors, sparse arrays, arrays with extra properties or another prototype, revoked and trapping `Proxy` values refused at their pointers, and a transparent `Proxy` answered as its target. | input-binding |
| I2 | A table reads each row once and owns nothing else of it: a row changed after composition changes no answer; `match.row` and every entry's `row` are the declared object itself (`===`); a payload getter is never called. | input-binding |
| I3 | For every guard form, state and flag, a row is admitted exactly when no guard refuses it; and the four guards of the I13 corpus's reference matcher, over all 128 combinations of their four flags and three states, admit exactly what that matcher admits. | input-binding |
| I4 | `matchInput`'s `match` is the one hit of `traceInput` for the same arguments, or `null` when there are none or several; `claimed` is as IB7 states -- over generated tables, facts, contexts and guard states. | input-binding |
| I5 | Order decides nothing: for every permutation of tenants and of rows in a generated table, every `matchInput` answer's `match.id` and `claimed` are unchanged. | input-binding |
| I6 | Spies count every predicate call, its order and its receiver: each admitted row's `on` once, each reached row's `when` once, every `on` before any `when`, each in table order, each with no receiver -- a strict predicate sees `this` undefined, a sloppy one the global object; a throwing predicate's exception propagates, and the table answers the next call as before. | input-binding |
| I7 | `findOverlaps` lists exactly the combinations in which two or more rows hit, in IB8's order, with `ids` in table order, and refuses a malformed guard state before calling any predicate, even with no facts. | input-binding |
| I8 | Binding reads no property of a fact but `at`, `button`, `pointerId` and `code`, each only in the operations IB1 names, in IB2's order, and writes none: a `Proxy` fact records every read; an accessor `at`, `button`, `pointerId` or `code` is refused with no getter called; a function given as a fact or a point is refused; frozen facts, contexts, rows and guard states are accepted. | input-binding |
| I9 | The press's `beyond` and `trigger` agree with an exact oracle that shares no code with the fallback over generated streams; over travels targeted within 10^-15 of the threshold, on both signs, near the origin and far from it; over values near `Number.MAX_VALUE`, where binary64 squares overflow, and subnormal or zero, where they underflow; and over cases built so the filter cannot decide them, each asserted to reach the fallback -- exact equality and one binary64 step either side, across exponents, from negative origins -- which mutations of the fallback's comparison, sign and subnormal decoding each fail; a release's position never changes a trigger. | input-binding |
| I10 | Over generated sequences of operations, every outcome names the phase IB11's tables give for the state before it; at most one gesture is live; each life ends at most once; started equals ended plus live; every refused operation throws and changes nothing. | input-binding |
| I11 | A point's getter, and a `Proxy`'s trap on any argument, that calls the session takes effect before the operation's transition, which sees the state it left -- a gesture argument whose `getOwnPropertyDescriptor` trap cancels the live gesture lets `startGesture` start; such code that calls the session and then throws leaves its own call's effect and nothing of the throwing operation's; and for each operation a malformed argument at each place in IB2's order stops the reading there, no later getter or trap called. | input-binding |
| I12 | Every state is frozen to its depth and holds no `-0`; it, its press and its gesture are each the very same value exactly when IB12 says; every record holds its properties in its written order; for arguments whose reading runs no application code the same sequence gives the same states and outcomes, and a counterexample marks the edge of that promise: one fact whose point's getter counts its reads gives two fresh sessions two origins. | input-binding |
| I13 | The table and the press reproduce a reference matcher and press: a corpus generated once from them -- tables stated as data with no word of the reference's, which the test turns into predicates, and streams of presses and moves -- passes, except the press points within the exact band, which the corpus lists apart, each with the reference's answer and the exact one; the corpus's provenance is recorded beside it (`test/corpus/README.md`) and in the decision record. | input-binding |
| I14 | The source names no consumer's vocabulary; the built files import no package and no runtime-specific module, name no global but the built-ins the build uses, and reach no `eval`, no `Function`, no clock, no timer and no source of chance. | gate |
| I15 | IB11's decided cases, and generated sequences of a gesture declaring g -- opened by a press of buttons 0 to 4 or with no press, the press taken or not, g `null` among them -- in which other buttons' presses and releases arrive as `pointerMove` in both orders and the closing `pointerUp` names any button: commit exactly when g is `null`, the release names g, or the press began with g; `press.button` holds no `-0` and survives restarts. | input-binding |
| I16 | Over generated sequences of `keyDown`, `keyUp` and `keysLost`, codes `''` and `null` among them, `keys` equals a model written apart, in order; repeats change nothing; untracked facts change nothing; outcomes, their key order and `released`'s identity as IB14 gives; no key operation changes the press or the gesture or makes a phase due; a code of another type and an accessor `code` are refused before the state is read. | input-binding |
| I17 | `resolvePress` against the five calls written out by hand, over generated sequences in which neither callback calls the session or changes the match it answered: the same states and outcomes; each row of IB15's table driven by recording callbacks, a match changed after `match` returns among them, answered as the table says; `match` never called on a taken press; `cancelled` seeing no live gesture. | input-binding |
| I18 | Over generated sequences of two pointers: a move or release of the pointer that is not the press's changes nothing and answers `otherPointer` `true`; facts with no `pointerId` answer as facts whose pointers are equal. | input-binding |
| I19 | Beside `0.1.0`: the I13 corpus and I10's generator, their facts carrying no `pointerId`, give `0.1.0`'s outcomes but for the chord sequences and the changes the closing paragraph below lists, the press records gaining `button` and `pointer` and the state `keys`. | input-binding |

I13 is held by `test/corpus/i13-corpus.test.js`, over the corpus `test/corpus/README.md` describes; I14 by `tools/check-vocabulary.mjs`, `tools/check-runtime.mjs` and `tools/check-clock-and-chance.mjs`, whose own tests are `test/tools/gate-checks.test.js`; I19 by `test/compatibility/beside-0.1.0.test.js`, which runs this build beside the released `0.1.0`, kept in `test/fixtures/`.

**What changes beside `0.1.0`.**
- A pointer fact whose `pointerId` is an accessor, or neither `null` nor a safe integer, is refused, where `0.1.0` passed it unread; and a pointer operation reads the fact's `pointerId` after everything it read before.
- The press gains `button` and `pointer`, the state `keys`, the session four functions after `cancelGesture`, and the move's and release's outcomes `otherPointer`; a `pointerDown` that differs from the press in its button or its pointer alone leaves a new press and state, where `0.1.0` left the very same.
- A chord's release commits its gesture: the second and fourth of IB11's decided cases.
- A move or release of another pointer while a press is held changes nothing: IB11's last decided case.

---

## Reference

This repository, `apnex/input-binding`, and its package `@apnex/input-binding`, released only by its own CI as a tarball attached to a GitHub release, drafted, verified and then published (`.github/workflows/release.yml`).\
The package exports `composeBindingTable` and `openGestureSession` from its one path, as `export-map.json` records.\
The code is TypeScript in `src/`, built to `dist/`, which only a release holds.\
The tests are in `test/`: one file per capability in `test/contract/`, with `argument-reading.test.js`, `returned-values-and-errors.test.js`, `public-types.test.js`, `public-surface.test.js` and `contract-coverage.test.js` beside them; the I13 corpus and its test in `test/corpus/`; the test beside `0.1.0` in `test/compatibility/`, over the released `0.1.0` kept in `test/fixtures/`; the typed consumer in `test/types/`; and the gate checks' own tests in `test/tools/`.\
The gate, `npm run gate`, builds, runs the tests, the vocabulary, runtime, clock and chance, and export-map checks in `tools/`, and mission-kit's style checks; its repository, gate and release follow `snap-grid`'s, the first component's.\
The design of record and the rulings that shape this component are kept in draw's records, `apnex/drawv2`.

---

## Fit criteria

**Does my project want this at all?**
- More than one surface -- a key, a press, a help overlay, a panel that follows the situation -- must agree on what an input means.
- You are about to write a ladder of `if` branches in which the order decides which one wins, or a read-only check placed at a line number.
- You are about to decide "click or drag", or which release ends a gesture, in a second place.
- You are about to write, again, the press's sequence -- make it, ask for its match, cancel the live gesture, start the one the match opens: a press is resolved in one call, `resolvePress` (IB15).

**It is the wrong tool when:**

| You need | Reach elsewhere, because input-binding is |
|---|---|
| platform events turned into facts, coordinates, a hit under the pointer | not a listener: that is `input-capture`, the hit test and coordinates the application's |
| a preview drawn, or what lies under a point | not a renderer: that is `vector-scene`, or the application |
| an action performed, an undo kept, a gesture's body run | not an executor: rows carry the application's payload, and phases are reported for the application's code to run |
| one row to win over another by priority | not a precedence engine: two hits mean nothing, and an overlap fails the application's gate |
| a hold, or a double click decided by time | not yet: binding reads no clock, and a timed trigger waits for a consumer, its time then a field of the facts |
| a second pointer's press told apart from the first's | not yet: one press, a second pointer's press replacing the first's; another pointer's moves and release are told apart by `pointerId` (IB11), and the session keeps the keys held (IB14) |
| bindings a person edits while the application runs | not a store: rows are source, composed once |

---

## Adjustment policy

Internal and sovereign: a measured gap is recorded where both sides can see it, then resolved by adjusting input-binding or by fracturing it if the gap reveals a second duty; never forked.

---

## Edges

**Contains:** the binding table and the gesture session.\
**Consumes:** nothing.\
**Consumed-by:** draw, and `input-tester`.

The tester needs of binding: its own tables, traced for every row's standing for each input (`traceInput`, IB6) and matched (IB7); every operation's outcome, to show a press becoming a drag and each phase as it falls due (IB12); IB14, to light the keys held and to match its roll-over row; IB15, for every mouse press; and IB11's rule, for every gesture.\
It draws its keys and its pointer from `input-capture`'s facts, which binding does not read beyond `at`, `button`, `pointerId` and `code`.
