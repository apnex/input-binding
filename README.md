# input-binding

Decide what each input means in its context: the one declared row it matches, and the phase it makes due for the gesture in progress.

---

## Install

input-binding is released only as a tarball attached to a GitHub release, made by its own CI, so a consumer names the release file and its lockfile pins the file's hash.

Choose a release from the repository's Releases page, `https://github.com/apnex/input-binding/releases`, and name its file in your `package.json`, writing that release's version for `<version>`:
```json
"dependencies": {
  "@apnex/input-binding": "https://github.com/apnex/input-binding/releases/download/v<version>/apnex-input-binding-<version>.tgz"
}
```

Then install, which records the file's `integrity` in `package-lock.json`, so every `npm ci` refuses a file whose hash differs:
```bash
npm install
```

The package has one export path, and it maps to one file: `index.js` in the package's `dist` folder, its types beside it in `index.d.ts`; that file imports the rest of the folder by relative path.\
A browser loads it as ES2022 modules: through an import map with one entry naming that file, never a trailing-slash prefix, or with the `dist` folder copied beside your page and imported by relative path.

---

## Use

Two functions, each of one duty: `composeBindingTable` makes a table that says which one row an input means, and `openGestureSession` opens a session that keeps one input surface's press, live gesture and held keys, and says which phase of the gesture each input makes due.\
Every rule is in `CONTRACT.md`, IB1 to IB15; this page holds every function and every shape you handle.

### Errors and values

The two constructors never throw: each answers `{ ok: true, table }` or `{ ok: true, session }`, or `{ ok: false, problems }`, each problem `{ pointer, problem }` -- an RFC 6901 pointer into your declaration and one of `not-an-object`, `unknown-property`, `missing-property`, `invalid-value`, `duplicate-field`, `duplicate-id` and `duplicate-name`.\
Every other function throws a `TypeError` whose message begins with its name -- `pointerDown: ...` -- for a malformed argument, and a session's operation throws an `Error`, the base constructor, beginning with its name, for an operation its state does not allow, changing nothing.\
Every value binding returns is frozen to its depth; your rows, facts, contexts and matches are handed back as given, never copied, frozen or changed.

### The table

A declaration holds `tenants`, each `{ owner, rows }`, and optionally `guards`, each `{ state, flag, default, refuses }` with `refuses` one of `state-and-flag`, `state-without-flag` and `flag-without-state`; `claim`, `{ flag, default }`; and `opens`, `{ field }`, the row property naming the gesture a press it matches opens.\
A row holds `id`, a non-empty string, `on`, a predicate over facts, optionally `when`, a predicate over contexts, a boolean under each guard's and the claim's `flag`, a gesture's name under the `opens` field, and any payload of yours, which the table never reads.

Compose a table whose rows are your own, with your guards, your claim flag and the field your press rows name their gesture in:
```js
import { composeBindingTable, openGestureSession } from "@apnex/input-binding";

const composed = composeBindingTable({
  guards: [{ state: "readOnly", flag: "mutates", default: true, refuses: "state-and-flag" }],
  claim: { flag: "prevent", default: true },
  opens: { field: "gesture" },
  tenants: [{ owner: "app", rows: [
    { id: "press-item", on: (fact) => fact.type === "down" && fact.button === 0, gesture: "press" },
    { id: "delete", on: (fact) => fact.type === "key-down" && fact.key === "Delete", run: "delete-selection" },
  ] }],
});
if (!composed.ok) throw new Error(JSON.stringify(composed.problems));
const { table } = composed;
```

The table answers for a fact, an optional context and an optional guard state, a plain object of booleans naming only states its guards declare:
- `table.matchInput(fact, context, guards)` answers `{ match, claimed }`: `match` the one row whose `on` and `when` both hold and no guard refuses, as `{ id, owner, opens, row }`, `row` your own row, or `null` when none or several do; `claimed`, whether any admitted row whose `on` held claims the input, whatever its `when` answered.
- `table.traceInput(fact, context, guards)` answers, for every row in table order, `{ id, owner, refusedBy, on, when, hit }`: refused by a guard, unbound, unmet, or a hit.
- `table.findOverlaps(facts, contexts, guardStates)` answers `{ fact, context, guards, ids }` for every combination in which two or more rows hit.
- `table.rows`, `table.guards`, `table.claim` and `table.opens` hold what was composed.

Two rows that both hit mean nothing -- no match, never one chosen by order -- so run `findOverlaps` over your facts in your own gate.\
A predicate is called with no receiver, at most once per call, and is expected to be pure; a fact and a context are handed to it unread.\
A fact is any value you hand, so a table may name your own outcomes -- a commit, say -- as facts.

### The session

Open a session from the threshold a press may travel and still be a click, in the units of your facts' `at`, and the gestures you declare, each `{ name, engaged, button }`, `button` the one whose presses the gesture takes while live, or `null`:
```js
const { session } = openGestureSession({ threshold: 4, gestures: [{ name: "press", engaged: false, button: 0 }, { name: "drag", engaged: true, button: 0 }] });
```

`session.state` is `{ press, gesture, keys }`: the press `{ at, beyond, unmatched, button, pointer }` or `null`; the live gesture `{ name, row, engaged }` or `null`; and the codes of the keys held, in the order first pressed.\
It is the very same value until an operation changes it.

Each operation reads only these of its fact, and answers a fresh outcome whose `phase` -- `start`, `update`, `become`, `commit`, `cancel` or `null` -- says what your own code should run, for the gesture `gesture` names:

| Call | Reads of the fact | Answers |
|---|---|---|
| `resolvePress(fact, { match, cancelled })` | `at`, `button`, `pointerId` | `{ state, taken, match, cancelled, phase, gesture }`, `phase` `start` or `null` |
| `pointerDown(fact)` | `at`, `button`, `pointerId` | `{ state, phase, gesture, taken }` |
| `pressMatched(match)` | -- | `{ state, phase, gesture }` |
| `pointerMove(fact)` | `at`, `pointerId` | `{ state, phase, gesture, crossed, otherPointer }` |
| `pointerUp(fact)` | `button`, `pointerId` | `{ state, phase, gesture, trigger, otherPointer }`, `trigger` `click`, `drop` or `null` |
| `pointerLost()` | -- | `{ state, phase, gesture }` |
| `startGesture({ gesture, row, from })` | -- | `{ state, phase, gesture }` |
| `becomeGesture({ gesture, from })` | -- | `{ state, phase, gesture, was }` |
| `cancelGesture()` | -- | `{ state, phase, gesture }` |
| `keyDown(fact)`, `keyUp(fact)` | `code` | `{ state, tracked, held }` |
| `keysLost()` | -- | `{ state, released }` |

A fact's `at` is a point, `{ x, y }` of finite numbers, whose `x` and `y` may be getters, as a browser's `DOMPoint`'s are; its `button` a safe integer; its `pointerId` absent, `null` or a safe integer; its `code` a string or `null`.\
Every other field is read only as an own data property, so a browser's `PointerEvent` or `KeyboardEvent`, whose fields are inherited getters, is refused: hand the session the facts a listener such as `input-capture` makes, or plain objects of your own.

Drive the session from your listener, the `...Bodies` being your own code for each phase:
```js
function onPress(fact) {
  const outcome = session.resolvePress(fact, {
    match: () => table.matchInput(fact, context, guards).match,
    cancelled: (cancel) => cancelBodies[cancel.gesture.name](),
  });
  if (outcome.phase === "start") startBodies[outcome.gesture.name](fact);
}

function onMove(fact) {
  const outcome = session.pointerMove(fact);
  if (outcome.otherPointer) return;
  if (outcome.crossed && outcome.gesture?.name === "press") session.becomeGesture({ gesture: "drag" });
  if (outcome.phase === "update") updateBodies[outcome.gesture.name](fact);
}

function onRelease(fact) {
  const outcome = session.pointerUp(fact);
  if (outcome.otherPointer) return;
  if (outcome.phase === "commit") commitBodies[outcome.gesture.name](outcome.trigger);
}

function onFocusLost() {
  session.keysLost();
  const outcome = session.pointerLost();
  if (outcome.phase === "cancel") cancelBodies[outcome.gesture.name]();
}
```

`resolvePress` makes the press, calls your `match` with no argument unless the live gesture takes the press, starts the gesture the match opens, and, when a gesture was live, cancels it first, calls your `cancelled` with that cancel, and then starts; `match` answering `null` leaves the press unmatched.\
It holds the two traps of doing it by hand: `pressMatched` throws on a press the live gesture took, and a cancel loses the start unless `pressMatched` is called a second time.\
Its outcome's `phase` is never `cancel`, which its `cancelled` alone reports; a callback that ends, replaces or matches the press stops the steps after it.

`becomeGesture` given `from` restarts the press from that point, not beyond the threshold, so a drag's release then counts as a click; to keep a drag a drop, become the next gesture without `from`.\
`startGesture`, `becomeGesture` and `pressMatched` throw when the session's state does not allow them: a gesture already live, none live, or no unmatched press.

A platform delivers a chord's later presses and releases as moves, so the release that ends a press may name another button than the one that began it; that release commits a gesture the press's button began, and a gesture of no button is committed by any release.\
A move or a release of a pointer that is not the press's changes nothing and answers `otherPointer` `true`, so return at once; facts with no `pointerId` are all of one pointer, and a second pointer's press replaces the first's.\
While the press holds a pointer that is not `null`, a fact naming none is another pointer's, so name `pointerId` on every pointer fact or on none.\
A gesture started with no press stays live until an input or a request ends it, so seeing every gesture end -- on a release, a lost pointer or a focus lost -- is yours.

`keyDown` keeps a code held and `keyUp` releases it; `held` says whether it was held before the call, so a `keyDown` answering `held` `true` is a repeat or a press whose release was not seen, and a `keyUp` answering `false` is a key pressed while the page lacked focus.\
A key whose `code` is `''` or `null` -- a media key, say, which names no physical key -- is answered `tracked` `false` and changes nothing, so show it as delivered.\
No release is promised once the key source loses focus, so call `keysLost` then, whose `released` is the array of codes held before.

In a test, hand the session plain objects:
```js
session.pointerDown({ at: { x: 0, y: 0 }, button: 0, pointerId: 1 });
session.pointerMove({ at: { x: 5, y: 0 }, pointerId: 1 });
console.log(session.state.press.beyond, session.pointerUp({ button: 0, pointerId: 1 }).trigger);
```

---

## Test

The gate builds, runs every test, the vocabulary, runtime, clock and chance, and export-map checks, and mission-kit's style checks over the Markdown.\
The tests, and the consumer test, run under `test-harness`'s runner, a development dependency pinned to its release file, which fails a run that leaves a file, a folder or a process behind.

Run the gate with a mission-kit checkout beside this repository, or with `MISSION_KIT` naming one:
```bash
npm ci
npm run gate
```

The consumer test packs the package, installs the file into an empty project, imports every export in Node, and loads every export in headless Chrome through an import map:
```bash
npm run consumer
```

The built size of each half, the table's and the session's, is measured after a build:
```bash
node tools/measure-halves.mjs
```

---

## Remove

Remove the dependency, and with it the lockfile's entry:
```bash
npm uninstall @apnex/input-binding
```

Then remove the import-map entry, or the copied `dist` folder, of each page that loads it.

---

## Status

Experimental until mission-kit admits it; it runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 modules.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component, the choices made at each build, and the built size of each half.
- `test/corpus/README.md` - how the corpus that holds it to a reference matcher and press was made.
- The guide to using the four components together -- `input-capture`, `input-binding`, `vector-scene` and `snap-grid` -- is `docs/GUIDE.md` in `https://github.com/apnex/input-tester`, written with the tester's first release, its code the worked example.
