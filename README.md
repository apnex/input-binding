# input-binding

Decide what each input means in its context: the one declared row it matches, and the phase it makes due for the gesture in progress.

**Status: experimental until mission-kit admits it; runs in the Node versions `package.json`'s `engines` names, and in browsers that support ES2022 and import maps.**

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

A browser loads it as ES2022 modules through an import map, so it needs a browser that supports both.\
The page maps the package's one export path to its file with one import-map entry, never a trailing-slash prefix.

---

## Use

Compose a table from your rows, then ask it what an input means; open a session, then hand it each pointer input and the press a row matched, and run your own code for the phase each outcome names.

Compose a table whose rows are your own, with your guards, your claim flag and the field your press rows name their gesture in:
```js
import { composeBindingTable, openGestureSession } from "@apnex/input-binding";

const composed = composeBindingTable({
  guards: [{ state: "readOnly", flag: "mutates", default: true, refuses: "state-and-flag" }],
  claim: { flag: "prevent", default: true },
  opens: { field: "gesture" },
  tenants: [{ owner: "app", rows: [
    { id: "drag-item", on: (fact) => fact.button === 0 && fact.over === "item", gesture: "move" },
    { id: "delete", on: (fact) => fact.key === "Delete", run: "delete-selection" },
  ] }],
});
if (!composed.ok) throw new Error(JSON.stringify(composed.problems));
const { table } = composed;
```

Open a session from the threshold and your gestures, and drive it from your pointer events, `context` and `startBodies` being your own:
```js
const { session } = openGestureSession({ threshold: 4, gestures: [{ name: "move", engaged: true, button: null }] });

function onPointerDown(fact) {
  session.pointerDown(fact);
  const { match } = table.matchInput(fact, context, { readOnly: false });
  if (match === null) return;
  const outcome = session.pressMatched(match);
  if (outcome.phase === "start") startBodies[outcome.gesture.name](fact);
}
```

`pointerMove`, `pointerUp` and `pointerLost` answer `update`, `commit` and `cancel` in the same way, and `startGesture`, `becomeGesture` and `cancelGesture` check your own requests against the same rules.\
`traceInput` says how far every row matched one input, and `findOverlaps` lists every combination in which two rows hit, for your gate to refuse; `CONTRACT.md` gives each rule, IB1 to IB13.

---

## Test

The gate builds, runs every test, the vocabulary, runtime and export-map checks, and mission-kit's style checks over the Markdown.

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

Then remove the import-map entry of each page that loads it.

---

## Documents

- `VISION.md` - why it exists, and what it will never be.
- `CONTRACT.md` - what a consumer can depend on, one capability per row, and every rule.
- `docs/DECISIONS.md` - the rulings about this component, the choices made at build, and the built size of each half.
- `test/corpus/README.md` - how the corpus that holds it to its first consumer's matcher and press was made.
