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
- Reading a value at its own pointer (IB2 rule 8) stops at the first reflection that refuses it: a prototype of another kind is refused before its own keys are read, an array holding an own key that is neither `length` nor an index before its `length` is read, an array whose keys miss an index before any element's descriptor is read, and an accessor element before the next element's descriptor.
- A key `Reflect.ownKeys` lists whose descriptor then reads as `undefined`, which only a `Proxy` can make, is absent: missing where its form requires it, a hole in an array, a state a guard state omits.
- A property is read by descriptor only when the value's own keys hold it, so a `Proxy` whose descriptor trap answers for a key its own keys did not list is never asked for it.
- A row's declared flags and `opens` field are read with its `id`, `on` and `when`, one row whole before the next, as rule 8 reads every value, not in a second pass over the rows.
- A guard state naming a state no guard declares is refused at the reading of its own keys, before any descriptor; a value that is no boolean, or an accessor, at its own descriptor, in the keys' order.
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
- The TypeScript declarations require `traceInput`'s and `matchInput`'s context, typed as the table's context; at run time an omitted one is `undefined`, as IB2 rule 3 says, and is handed to `when` unread.
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
- The tools, workflows, `tsconfig.json`, `.gitignore` and `LICENSE` are snap-grid's, renamed; the release refuses a version outside `0.x` under the design's D12, as snap-grid's under its D9.
- `tools/measure-halves.mjs` measures the built size of each half, the shared modules counted apart.

**The built size of each half.**\
Measured at build by `tools/measure-halves.mjs` over `dist/`, as the design's section 7 and D11 ask: one export path and no dynamic import load both halves wherever either is imported.\
Bytes as shipped, comments included, then with comments removed, each also gzipped at level 9:

| Half | Files | Bytes | Gzip | No comments | Gzip |
|---|---|---|---|---|---|
| the table | `binding-declaration.js`, `binding-table.js` | 18,377 | 5,177 | 14,539 | 3,570 |
| the session | `session-declaration.js`, `gesture-session.js`, `travel-beyond.js` | 22,135 | 6,490 | 15,990 | 4,155 |
| the exact distance, within the session | `travel-beyond.js` | 4,479 | 1,725 | 2,298 | 818 |
| shared | `reflection.js`, `argument-reading.js`, `declaration-problems.js`, `index.js`, `types.js` | 13,304 | 4,720 | 8,106 | 2,584 |

So a consumer of the table alone, such as draw's server and export through its drag grammar, loads about 22 KB of the session's code it never runs, about 4 KB gzipped once comments are removed.
