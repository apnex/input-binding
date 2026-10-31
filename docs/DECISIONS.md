# Decisions

One ruling per entry, append-only.\
A ruling is never edited; a later one supersedes it and says so.

Rulings that shape this component together with its first consumer are held in draw's `dev/DECISIONS.md` (`apnex/drawv2`), and cited here as "draw's `Hn-m`".

---

## D1 - The component stands in its own public repository

**Ruled by:** the director, 2026-10-20 (draw's `H26-1` and `H26-2`).\
**Affects:** this repository, its package and its releases.

**Ruling.**\
input-binding is a component of its own, in the public repository `apnex/input-binding`, its package `@apnex/input-binding`, released from its own CI and taken by draw as a release file pinned by its hash.\
Its versions are `0.x` until mission-kit admits it to the component registry.

**Why.**\
Each component holds its own boundary and its own history from the start, so a consumer composes it through a declared contract rather than a copy, and a second consumer can adopt it without a fork.

---

## D2 - The contract of record is draw's ratified design

**Ruled by:** the director, 2026-10-20 (draw's `H26-6`).\
**Affects:** `CONTRACT.md`, `VISION.md`, `src/`, `test/`, `tools/` and `.github/workflows/`.

**Ruling.**\
The contract of record is section 3 of draw's `dev/design/components/INPUT-BINDING.md`, revision 5, ratified with all fourteen of its decisions as recommended; `CONTRACT.md` carries it, its section 4 holds the invariants and tests, and its section 7 states where this repository differs from `snap-grid`'s, whose repository, checks, gate and release it otherwise follows.\
`VISION.md` is that design's appendix A, ratified as written.

**Choices made at build, each confirmed by the recorder.**\
Where section 3 was silent or left a choice open, the build made these; each that a test can hold is held by one, and each that a consumer can observe is stated here:
- Reading a value at its own pointer (IB2 rule 8) stops at the first reflection that refuses it: a prototype of another kind is refused before its own keys are read, an array holding an own key that is neither `length` nor an index -- an index being a canonical integer string below 2^32 - 1, so `"4294967295"` is none (the run-verifier's V-2) -- before its `length` is read, an array whose keys miss an index before any element's descriptor is read, and an accessor element before the next element's descriptor.
- A phantom key -- one `Reflect.ownKeys` lists whose descriptor then reads `undefined`, which only a `Proxy` can make -- is judged by what IB2's order reads of it, after the run-verifier's V-3: where the order reads its descriptor -- a property a declaration's or an argument's form names, an array's index, every key of a guard state, a fact's `at` and `button`, a match's `id` and `opens` -- it is absent, and judged only once that descriptor is read, so it is missing where its form requires it, a hole in an array, and in a guard state no state at all, declared or not; where the order reads no descriptor of it -- a property a declaration's or a gesture argument's form does not name, an array's key that is no index -- it is known by its key alone, as IB2 rule 8 says, so it is an unknown property in a declaration, malformed in a gesture argument and another own property of an array; making it absent there too would mean reading a descriptor IB2's order does not read, so the rule stops at the order.
- A property is read by descriptor only when the value's own keys hold it, so a `Proxy` whose descriptor trap answers for a key its own keys did not list is never asked for it.
- A row's declared flags and `opens` field are read with its `id`, `on` and `when`, one row whole before the next, as rule 8 reads every value, not in a second pass over the rows.
- A guard state's keys are judged each at its own descriptor, in the order its own keys gave them, as IB2's table reads them: a key whose descriptor reads `undefined` is absent; a present key naming a state no guard declares, holding an accessor, or holding a value that is no boolean is refused there, so the descriptors of the keys before it have been read and none after (V-3; the first build refused an undeclared name at the reading of the keys).
- A gesture argument holding a key its form does not name, or no `gesture`, is refused at the reading of its own keys, before `gesture`'s descriptor is read.
- `pressMatched` reads its match's prototype, `id` and `opens` and never its own keys, as IB2's table lists, so a match holding other properties -- a table entry's `owner` and `row` -- is accepted.
- A fact handed to a pointer operation is judged by `typeof` alone, which runs no trap; its prototype is never read.
- A function, method or operation reads no argument beyond those its form names, so an extra argument -- to `pointerLost` and `cancelGesture` any argument -- is never read.
- `matchInput`'s `match` is the row's entry in `table.rows` itself, the very object composition returned, as "made afresh by the call that first returns it" allows.
- A table is a frozen plain object of exactly `rows`, `guards`, `claim`, `opens`, `traceInput`, `matchInput` and `findOverlaps`, in that order; a session a frozen plain object of exactly `declaration`, `state`, then its eight operations in the order IB11's tables give them; `state` is an accessor answering the current state, since a frozen session must answer a state that changes.
- Every function binding makes is frozen with the value that holds it, and none needs a receiver, so an operation taken off its session or table works the same.
- An open result holds `ok` and then `table`, `session` or `problems`.
- A `TypeError`'s message is the bare function name, a colon and prose -- `matchInput: ...`, not `table.matchInput: ...`; an error a getter or trap threw is named in the prose after "could not be read:".
- An `Error` refusing an operation the lifecycle does not allow is of the base constructor, its message the operation's name, a colon and prose.
- A guard state given to a table that declares no guard is malformed if it names any state, `false` among them, as IB5 reads literally.
- IB9's "among valid names" judges each name at its own pointer whatever its siblings, as IB3 step 6 judges a field, so a gesture whose `engaged` is invalid still gives its name; IB3 step 10 likewise counts every row whose `id` is valid, whatever the row's, the tenant's or the declaration's other problems.
- The fallback answers not beyond when all five values are zero, the least exponent "among the nonzero ones" then being undefined, and `0 > 0` false; the filter leaves that travel to it, since neither of its comparisons holds.
- The press holds no button, as IB10's form gives it, so a press at the press's own point, not beyond, with an equal `unmatched`, leaves the very same state whatever its button; a button decides only whether a press is taken and whether a release commits.
- The TypeScript declarations make `traceInput`'s and `matchInput`'s context optional exactly when `undefined` is assignable to the table's context type, the default `unknown` among them, and required otherwise (`ContextAndGuards`, a rest tuple, after the run-verifier's V-4); at run time an omitted context is `undefined`, as IB2 rule 3 says, and is handed to `when` unread; `test/types/context-consumer.mts`, compiled by `test/contract/public-types.test.js` with `tsc --noEmit` under strict settings with and without `exactOptionalPropertyTypes`, holds both cases, the second by lines that must fail to compile.
- `composeBindingTable` is generic in the fact, the context and the row, so an entry's `row` is the consumer's own row type; the session's pointer operations take structural facts, `{ at, button }`, `{ at }` and `{ button }`, any fact holding them assignable.
- `CONTRACT.md` adds snap-grid's Requires and Trait columns, marking the session's three capabilities `stateful`, T1's trait, by the design's sentence that the session is stateful in T1's sense, and the table's `none`.
- `CONTRACT.md` replaces the design's section references with "the design's", carries section 4's invariants, and condenses IB10's history of the design's prototypes into one sentence naming what they showed, the build's own tests holding it again (I9).
- I9's oracle (`test/support/travel-oracle.js`) makes each value an exact fraction by doubling it until it is an integer, never reading bits, so it shares no code with the fallback.
- I9's tests import the built `dist/travel-beyond.js` by path, which the package does not export, to assert that every built case reaches the fallback; its mutations are made as text on that very file, each replaced string asserted to occur exactly once, and the mutant imported from a scratch copy, so the mutated code is the build's own.
- I9's built cases are the third reading's prototype's -- five Pythagorean triples scaled by every seventh power of two, exact equality and one step either side, a negative origin, a sign that matters -- with distant origins and the two press points of the I13 corpus where a subnormal coordinate decides it added.
- I13's corpus is generated by `tools/generate-i13-corpus.mjs` from the three files at `5b4997b`, taken with `git archive` from draw's object store into a scratch directory, never a working tree; its exact answers come from the test oracle, not from `src/`.
- I13's corpus states draw's four flags as `f0` to `f3`, its three states as `s0` to `s2`, its claim flag as `c0` and its gesture field as `o`, and its guards in input-binding's form from the design's section 5; its `admission` list holds them to draw's own rule for every flag and state true, false or omitted, and the guard state omitted -- 2,268 cases, the 128 I3 asks among them.
- I13's tables state each predicate as the fields of a fact or context it requires equal and the kind of value it answers -- boolean, number, string or object -- so the corpus exercises truthiness as draw's `filter` and binding's `if` both read it.
- I13's corpus lists apart every stream on which draw's answers differ from the exact ones, with both answer lists and each press point where `Math.hypot`'s decision differs, its reason, draw's distance and the sign of the exact difference; the band is not given a width by the design, so the test asserts each listed point lies within 10^-14 of the threshold.
- I13's streams map draw's `chained` note to `startGesture` or `becomeGesture` with `from`, by whether a gesture is live, and its pointer `cancel` to `pointerLost`; the test declares one gesture, engaged, of no button, which no press takes.
- I13's edge family draws each move again until `Math.hypot` of its rounded differences lies within 3 x 10^-15 of the threshold, since adding a travel to an origin of hundreds of units rounds by about 10^-13; so its rate of points apart measures that band, not draw's use, and is not the design's 0.05%.
- The consumer test's exercise, run in Node and in the page alike, composes a table, matches a press, presses, moves exactly the threshold and then one binary64 step beyond it -- decided by the fallback, so `BigInt` runs in Chrome -- and releases.
- The vocabulary lists are snap-grid's, both of them, unchanged; no word of either is needed, so no allowance is asked.
- The tools, workflows, `tsconfig.json`, `.gitignore` and `LICENSE` are snap-grid's, renamed, beside input-binding's own `generate-i13-corpus.mjs`, `measure-halves.mjs` and `check-clock-and-chance.mjs`; the release refuses a version outside `0.x` under the design's D12, as snap-grid's under its D9.
- `tools/measure-halves.mjs` measures the built size of each half, the shared modules counted apart.
- Beyond the seven capability files the design's section 4 asks for, `test/contract/` holds `argument-reading.test.js` (IB1 and IB2 for the session's operations, I8, and I11's stopping points), `returned-values-and-errors.test.js` (the Errors and What is returned paragraphs), as snap-grid's holds the latter, and `public-types.test.js` (the published types), as shape-check's does; each constructor's reading order stays in its capability's file.
- IB13's "reads no clock and no randomness, and holds no timer" is held by a check of the gate's own, `tools/check-clock-and-chance.mjs`, run after the runtime check, which looks only for runtime globals and imports; it walks each built file's syntax tree and fails on an identifier naming a clock, timer, source of chance or network global; on `Math.random`, and on a member named `random` or `now` reached by brackets with a string literal on `Math`, `Date` or `performance`; on any use of `Math` as a value other than a direct member access by identifier, so `Math.max(1, 2)` passes and `const m = Math` does not; and on destructuring from `Math`, `Date` or `performance` (after the run-verifier's V-1, whose two plants, `Math["random"]()` and `const { random } = Math; random()`, are among its falsifiers in `test/tools/gate-checks.test.js`).

**The built size of each half.**\
Measured by `tools/measure-halves.mjs` over `dist/` as built after the run-verifier's notes, as the design's section 7 and D11 ask: one export path and no dynamic import load both halves wherever either is imported.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Half | Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|---|
| the table | `binding-declaration.js`, `binding-table.js` | 18,872 | 5,306 | 14,900 | 3,649 |
| the session | `session-declaration.js`, `gesture-session.js`, `travel-beyond.js` | 22,135 | 6,490 | 15,990 | 4,155 |
| the exact distance, within the session | `travel-beyond.js` | 4,479 | 1,725 | 2,298 | 818 |
| shared | `reflection.js`, `argument-reading.js`, `declaration-problems.js`, `index.js`, `types.js` | 14,506 | 5,068 | 8,476 | 2,639 |

So a consumer of the table alone, such as draw's server and export through its drag grammar, loads about 22 KB of the session's code it never runs, about 4 KB gzipped once comments are removed.

---

## D3 - The contract of record for 0.2.0 is the components' next releases

**Ruled by:** the director, 2026-10-24 (draw's `H26-14`).\
**Affects:** `CONTRACT.md`, `README.md`, `src/`, `test/`, `tools/`, `.github/workflows/`, `export-map.json` and `package.json`.

**Ruling.**\
The contract of record for `0.2.0` is section 3.2 of draw's `dev/design/components/RELEASES-0.2.md`, revision 4, with what its section 3.5 asks of all four components -- contracts freed of draw, the consumer reference, the gates for B424 and the vocabulary lists -- ratified with all nineteen of its decisions as recommended; `CONTRACT.md` carries it, each rule stated on its own terms, its one provenance line under Reference.\
D2's build choice that the press holds no button is superseded by IB10, which gives the press its button and its pointer.

**Choices made at build.**\
Where section 3.2 or 3.5 was silent or left a choice open, the build made these; each that a test can hold is held by one, and each that a consumer can observe is stated here:
- A key fact's `code` is required, as a fact's `at` and `button` are: absent, present as `undefined`, inherited, an accessor or of another type than a string or `null` is the function's own `TypeError`, since IB1 reads every property an operation reads but `pointerId` as an own data property.
- A fact's `button` and `pointerId` are written `v + 0` as they are read, so the press holds no `-0`; `pointerId` `-0` is the pointer `0`.
- A fact whose `pointerId` is absent, handed while the press holds a pointer that is not `null`, is another pointer's: IB11's table compares `!==`, and an absent `pointerId` means `null`; I18's "facts with no `pointerId` answer as facts whose pointers are equal" is held as sequences whose facts all name none (erratum 3).
- IB15's "the press" is counted: every `pointerDown`, the one `resolvePress` makes among them, takes a new number, which a move or a restart keeps, so a `pointerDown` inside a callback replaces the press even when the record it leaves is the very same one under IB12; a press `pointerUp` or `pointerLost` ends is `null`, so its number is never held again (a mutant that dropped `pointerUp`'s reset of the number survived, as it must, and the reset, dead code, was removed with `pointerLost`'s).
- `resolvePress` judges its handlers' keys as `startGesture` judges an argument's: a key other than `match` and `cancelled`, or no `match`, is refused at the reading of its own keys, before `match`'s descriptor; a `cancelled` whose descriptor reads `undefined` is absent; one present as `undefined` is malformed.
- IB12's rule that a session calls no application code but a point's getters and a `Proxy`'s traps gains its one exception, `resolvePress`'s `match` and `cancelled`, each called after the transition before it, the state read again after each returns; it stands beside the table's predicates (IB6), which have run application code since the first build, and as there, binding cannot detect a callback that is not what it claims, so IB15's table says what each callback's calls into the session do.
- `match`'s answer is read once `match` returns, so a trap of that answer may call the session, and step 4 reads the state after it; a refusal of it names "match's answer".
- `resolvePress`'s outcome holds `match` `null` when the press was taken or `match` answered `null`, and otherwise the value `match` answered, even when a callback ended the press; its `cancelled` is the very outcome handed to `cancelled`, whose `state` is the state the cancel left.
- A key operation's outcome holds no `phase` and no `gesture`, as IB14 gives `{ state, tracked, held }` and `{ state, released }`; `keysLost` reads no argument.
- Each session holds an empty array of keys of its own, made when it opens, so two sessions share nothing, not even that; `keysLost` with keys held leaves a new frozen empty array, and with none held the very same state.
- The declarations export `KeyFact` beside the four types section 3.2 names, since it is the parameter type of `keyDown` and `keyUp`; `ResolvePressHandlers` and `ResolvePressOutcome` are generic in the match, so the outcome's `match` is the consumer's own entry type, a table's `BindingEntry<Row>`; `PointerUpOutcome`'s `trigger` is typed `Trigger | null`.
- `press-resolution`'s trait is `stateful`: section 3.2 names `held-keys` stateful and gives `press-resolution` none, and the contract marks every row the session serves stateful, as it marked the first three, `resolvePress` changing the session's state.
- Section 3.2's new fit-criteria row, "a press resolved in one call -- `resolvePress`", is a reason to want the component, not a reason to reach elsewhere, so `CONTRACT.md` states it under "Does my project want this at all?".
- The Errors paragraph's "reads and checks its arguments ... before it reads the session's state" names its one exception, the answer of `resolvePress`'s `match`, which IB15 reads after the transition before it.
- `CONTRACT.md`'s I3 and I13 name the I13 corpus's reference as a test's provenance: that reference is draw's matcher and press, `kernel/input-rules.mjs`, `app/src/input-state.js` and `app/src/triggers.js` at `5b4997b`, as D2 and `test/corpus/README.md` record; the corpus is unchanged.
- I19's `0.1.0` is the released file: the built `.js` files of the `v0.1.0` release tarball, as draw's lockfile pins it by its hash and draw's installed copy holds them, found byte-identical to a build of the tag with TypeScript 5.9.3, kept in `test/fixtures/input-binding-0.1.0/` and pinned in the test by each file's SHA-256 in base64, so no hexadecimal identifier is written; the release's tarball is not kept, the repository ignoring `*.tgz`, and CI's checkout holds no tag to build from.
- I19 compares every outcome with the press's `button` and `pointer`, the state's `keys` and `otherPointer` set aside, and whether each of the state, the press and the gesture is the very same value; it lists apart each generated sequence from its first chord release, both answers asserted, and allows a different identity only for a press new by its button alone; it compares every argument's reads with recording `Proxy` values, `0.2.0` reading the fact's `pointerId` after them.
- I10's generator moved into `test/support/lifecycle-model.js` as `randomOperation`, drawing the same random numbers in the same order, so I10 runs the sequences it ran at `0.1.0` and I19 runs them beside `0.1.0`; the lifecycle model states IB10, IB11 and IB14 again for I10, I15, I16 and I18, sharing no code with `src/`.
- IB11's decided cases are kept in `test/support/decided-cases.js`, each with both columns, run by I15 on this build and by I19 on both.
- The test beside `0.1.0` is in `test/compatibility/`, matched by the gate's test glob; the held-keys and press-resolution capabilities have their own files in `test/contract/`, held there by the contract-coverage test.
- `public-types.test.js` compiles the consumer again with its `@ts-expect-error` directives taken out, each expected error required on its own line and no other, as `vector-scene`'s does; the consumer types `resolvePress` with a table's match, the key operations and the press's new fields.
- `contract-coverage.test.js` holds GR4: the provenance line is the one line naming draw's records, it stands under Reference, and no line of `CONTRACT.md` holds a path of draw's, "the design's", a ruling's or a backlog row's id, a design file's name or the corpus's commit.
- The consumer test's exercise resolves its press in one call, moves another pointer, releases a chord naming another button, and holds, skips and loses keys, in Node and in headless Chrome alike.
- `README.md`'s examples were run at build, by a script outside the repository, against the built package: a press started, updated, become a drag, another pointer's move ignored, committed as a drop, and a focus loss cancelling.
- The runtime check is `vector-scene`'s, taken whole but its platform-member pass, as section 3.5 says: its runtime names with `eval` and `Function`, its refusal of a call through a property named `constructor`, and its allow-list of the globals the build names, here fifteen (erratum 1); the clock and chance check gains `Intl`, `Temporal`, `WeakRef` and `FinalizationRegistry`; `eval`, `Function` and the call through `constructor` stay the runtime check's, as in `input-capture` and `vector-scene` (erratum 2).
- The release workflow's lookup of its draft is `vector-scene`'s, retried twelve times five seconds apart; a test holds the loop bounded, after the create and before exactly one draft is required.
- The vocabulary list named `gesture-tester` is named `input-tester`, its words `keyboard` and `keycap` kept; no new word of input-binding's is in either list.

**Errata to raise against the design** (`RELEASES-0.2.md`):
1. Section 3.5's row for input-binding allows "the thirteen and `ArrayBuffer`, `BigInt` and `DataView`"; `WeakMap`, one of the thirteen, is named by no built file of input-binding -- `vector-scene`'s check run over the `v0.1.0` build, and this build, find `Array`, `ArrayBuffer`, `BigInt`, `DataView`, `Error`, `JSON`, `Map`, `Math`, `Number`, `Object`, `Reflect`, `Set`, `String`, `TypeError` and `undefined` -- and the check holds its list to exactly the globals the build names, a test failing otherwise. The row should read "the thirteen but `WeakMap`, and `ArrayBuffer`, `BigInt` and `DataView`".
2. Section 3.5's clock-and-chance column lists `eval`, `Function` and a call through `constructor` among the forms taken; in `input-capture` and `vector-scene`, whose checks are taken, those three are the runtime check's, and the gate refuses all seven forms here as there, by its two checks together. The column should name the runtime check for those three.
3. I18's "facts with no `pointerId` answer as facts whose pointers are equal" holds of a sequence whose facts all name no pointer; by IB11's table, a release naming none while the press names one is another pointer's. The sentence should say "a sequence of facts with no `pointerId`".

**Mutants (GR2).**\
Each new rule's tests were run against mutants of it, each made as text on one file, built when it was a file of `src/`, and run against the tests that hold that file -- the contract, corpus and compatibility tests for `src/`, the gate checks' tests for `tools/` and the workflow, the contract-coverage test for `CONTRACT.md`, the test beside `0.1.0` for its fixture -- by a driver outside the repository, every file restored after each and the tree found clean after all; every one of the 52 was killed, the verifier's M7 among them, which survived the tests sealed and was killed once I11's case for `resolvePress` was added:

| Rule | Mutant | Tests failing, one of them |
|---|---|---|
| IB1 | a `pointerId` of any value accepted | 4, I19's changes beside `0.1.0` |
| IB1 | a `pointerId` of `-0` kept | 2, IB1's `pointerId` values |
| IB2 | `pointerId` read before `button` | 4, I19's reads |
| IB2 | `pointerMove` reading no `pointerId` | 5, I19's reads |
| IB1 | a `code` of another type accepted | 3, IB1's `code` |
| IB1 | a `code` absent taken as `null` | 1, IB1's `code` |
| IB10 | the press's `button` always 0 | 10, I19's decided cases |
| IB10 | a restart losing the press's `button` | 5, I19 over I10's generator |
| IB12 | identity ignoring the press's `button` | 5, I19 over I10's generator |
| IB12 | identity ignoring the press's `pointer` | 3, IB1's `pointerId` values |
| IB11 | a release committing only by the gesture's button, as `0.1.0` | 8, I19's decided cases |
| IB11 | a gesture of no button committed only by a button | 12, I19's decided cases |
| IB11 | another pointer's release ending the press | 5, I19's decided cases |
| IB11 | another pointer's move changing the press | 1, I18 |
| IB11 | another pointer's release answering a click | 2, I15's decided cases |
| IB11 | a fact with no `pointerId` never another pointer's | 1, I18 |
| IB11 | another pointer's move answering `otherPointer` `false` | 1, I18 |
| IB12 | `keyUp` before `keyDown` in the session's order | 2, the fixture's session keys |
| IB12 | the state's `keys` first | 2, IB14's outcomes and state |
| IB12 | a new state at every key operation | 4, I19 over the corpus |
| IB14 | a repeat appended again | 2, IB14's `keyDown` |
| IB14 | a new key put first | 5, IB14's `keyDown` |
| IB14 | `keyUp`'s `held` inverted | 2, IB14's `keyUp` |
| IB14 | an empty `code` tracked | 2, IB14's untracked keys |
| IB14 | `keysLost`'s `released` a copy | 2, IB14's `keysLost` |
| IB14 | `keysLost` clearing nothing | 3, IB14's `keysLost` |
| IB14 | a key operation ending the press | 2, IB14's press and gesture kept |
| IB15 | `match` called on a taken press | 3, IB15's taken press |
| IB15 | no second transition after a cancel | 4, IB15's cancel then start |
| IB15 | a second transition though `cancelled` started a gesture | 1, IB15's table, `cancelled` rows |
| IB15 | a press replaced inside `match` still transitioning | 2, IB15's table, `match` rows |
| IB15 | a `pointerDown` inside `match` keeping the press's number | 2, IB15's table, `match` rows |
| IB15 | `cancelled` called with a receiver | 1, IB15's cancel then start |
| IB15 | `match` called with the fact | 1, IB15's start |
| IB15 | the match read again for the second transition | 2, IB15's match changed after it returned |
| IB15 | the outcome reporting `cancel` as its phase | 1, IB15's table, `cancelled` rows |
| IB15 | a `null` answer read as a match | 5, IB15's action and `null` |
| IB15 | handlers holding another key accepted | 1, IB15's malformed handlers |
| IB15 | `cancelled` present as `undefined` taken as absent | 1, IB15's malformed handlers |
| IB15 | `cancelled`'s descriptor read before `match` is judged, the verifier's M7 | 1, I11's malformed arguments to `resolvePress` |
| IB15 | the handlers read before the fact | 2, IB2's `resolvePress` reads |
| B424 | the runtime check allowing `WeakMap` too | 1, I14's allow-list |
| B424 | the runtime check with no allow-list | 2, I14's allow-list |
| B424 | the runtime check letting `eval` and `Function` through | 3, I14's runtime plants |
| B424 | the runtime check letting a call through `constructor` pass | 2, I14's runtime plants |
| B424 | the clock check letting `Intl`, `Temporal`, `WeakRef` and `FinalizationRegistry` pass | 1, IB13's clock plants |
| B424 | the release looking its draft up once | 1, the release's retry |
| B424 | the release retrying without bound | 1, the release's retry |
| 3.5 | the tester's list still named `gesture-tester` | 1, I14's vocabulary |
| GR4 | a contract line citing the design | 1, the contract's provenance |
| GR4 | a contract line naming a draw file | 1, the contract's provenance |
| I19 | the `0.1.0` fixture altered | 4, the fixture's pins |

**The built size of each half.**\
Measured by `tools/measure-halves.mjs` over `dist/` as built at `0.2.0`, as at the first build: one export path and no dynamic import load both halves wherever either is imported.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Half | Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|---|
| the table | `binding-declaration.js`, `binding-table.js` | 18,872 | 5,306 | 14,900 | 3,649 |
| the session | `session-declaration.js`, `gesture-session.js`, `travel-beyond.js` | 31,160 | 8,467 | 22,084 | 5,216 |
| the exact distance, within the session | `travel-beyond.js` | 4,479 | 1,725 | 2,298 | 818 |
| shared | `reflection.js`, `argument-reading.js`, `declaration-problems.js`, `index.js`, `types.js` | 14,506 | 5,068 | 8,476 | 2,639 |

The session grew by 9,025 bytes as shipped, 6,094 once comments are removed, for its four operations, its keys and its other pointer; the table did not change.

---

## D4 - The tests run on test-harness

**Ruled by:** the director, 2026-10-31 (draw's `H26-19` as amended: no test run may leave anything behind, and what the repositories' copies share is one component, `test-harness`, taken by each in its tests alone, pinned to its release file).\
**Affects:** `package.json` and its lockfile, `tools/consumer-test.mjs` and the tests that make scratch folders; nothing in `src/`, and nothing the package ships.

**Ruling.**\
`@apnex/test-harness` `0.1.0` is a development dependency, pinned to its release file by its URL and, in the lockfile, by its hash; `files` is unchanged, so no file of it is packed.\
`npm test` runs the tests under its runner, `test-harness run`, and `npm run consumer` the consumer test under `test-harness exec`, so each run has a folder of its own and fails on anything left in it or still running after it.\
The consumer test serves the page and the installed files with `serveStatic` and loads them in a one-shot Chrome with `dumpDom`, in a folder of its own -- so Chrome's lock folder, crash reporter and keyring use no longer reach the caller's temporary folder or the user's own -- and its scratch folder is a `scratchFolder`, removed however the test ends; the page, the import map and the exercise are its own, as before.\
The tests' scratch folders are `scratchFolder`s too.\
The consumer test's `--keep` is gone: a folder kept would be one the run fails on.\
The runner is not given `--test-force-exit`, which `test-harness`'s README recommends: on Node 22 it cut the results a test file reports when they are many -- `snap-grid`'s `test/contract/declared-grid.test.js` reported 61 of its 78 tests with it -- and no test here leaves anything running for it to end.
