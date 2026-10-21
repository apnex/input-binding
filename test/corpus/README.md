# The I13 corpus

`i13-corpus.json` holds draw's matcher and press at commit `5b4997b`, stated as data with no word of draw's (CONTRACT.md, I13).\
It was generated once by `tools/generate-i13-corpus.mjs` and is never written by hand; `i13-corpus.test.js` holds input-binding to it.

---

## How it was made

Run the generator against draw's repository; it reads the commit from git's object store, never from a working tree:
```bash
TMPDIR=/tmp/opencode node tools/generate-i13-corpus.mjs ../drawv2
```

It resolves `5b4997b` in that repository, takes `kernel/input-rules.mjs`, `app/src/input-state.js` and `app/src/triggers.js` from it with `git archive`, unpacks them into a scratch directory of its own under `TMPDIR`, imports them there, and removes the directory.\
The commit and each file's blob hash are written into the corpus, as `commit` and `blobs`.\
Its random choices are seeded (`seed`, 20261021), so a second run writes the same bytes: two runs at build gave the same SHA-256, `935cc818aa03ed7c134d1b6faf70bac320e914d2426f2266cd13c1c316bbcb07`.

It calls draw's own functions:
- `composeRules`, `resolveInput` and `overlapsIn` (`kernel/input-rules.mjs:43-79`), for every table;
- `initialInputState` and `track` (`app/src/input-state.js:34-50`), for every stream;
- `dragging` and `releaseTrigger` (`app/src/triggers.js:17-23`), after each step and at each release, with `DRAG_THRESHOLD` checked to be 4.

Every exact answer comes from `test/support/travel-oracle.js`, which makes each value an exact fraction by doubling it and shares no code with input-binding.

---

## What it holds

Draw's names never reach the file: its four guard flags are `f0` to `f3` (`mutates`, `whileReadOnly`, `duringHelp`, `duringGesture`), its three states `s0` to `s2` (`readOnly`, `helpOpen`, `gesturing`), its claim flag `c0` (`prevent`) and its gesture field `o` (`gesture`).\
The guards are stated in input-binding's form, as the design's section 5 gives draw's declaration, and `admission` holds them to draw's own rule.

| Part | What it is | Count |
|---|---|---|
| `admission` | one row, `on` always true, under every combination of the four flags and three states, each true, false or omitted, and the guard state omitted; draw's answer is whether the row matched | 2,268, of which 128 have every flag and state given; 789 admitted |
| `tables` | generated tables of 1 to 3 tenants and 2 to 10 rows, each predicate stated as the fact or context fields it requires equal and the kind of value it answers, with 3 to 6 facts, 2 to 4 contexts and 3 to 5 guard states | 40 tables, 223 rows |
| `tables[].answers` | draw's match and claim for every guard state, the omitted one among them, every context and every fact | 2,670, of which 805 match and 1,105 claim |
| `tables[].overlaps` | draw's overlaps over each table's facts, contexts and guard states, by index | 165 |
| `refusals` | tables in which an id is taken twice, with the id and the two owners draw's error names | 12 |
| `streams` | streams on which draw's answers equal the exact ones | 2,205: 394 general, 1,811 edge |
| `apart` | streams on which they differ, with both answer lists and every press point | 195: 6 general, 189 edge |

A stream is a list of steps -- `down`, `move`, `up`, `lost` and `restart` -- and its answers, after each step whether the press is a drag, and for a release what it is.\
The general family mixes presses, moves aimed on, inside and beyond the threshold, on a quarter lattice, one binary64 step from it, at extremes and subnormals, releases, lost pointers, restarts and second presses, 10,689 steps in all with the edge family.\
The edge family is a press across the drawing, one or two moves whose travel `Math.hypot` puts within 3 x 10^-15 of the threshold, and a release.

---

## The press points listed apart

Each of `apart`'s 198 press points is a move where `Math.hypot` of the rounded differences lies on the other side of the 4-unit threshold from the exact distance, with `reference` (draw's answer), `exact`, `hypot` (draw's distance), `exactSign` (the sign of the exact squared distance less 16) and `reason`.\
Every one lies within 9 x 10^-16 of 4.

- 197 are moves whose exact distance exceeds 4 where `Math.hypot` answers 4 or less -- 187 of them exactly 4 -- so draw keeps the press a click and the session makes it a drag: the reason "Math.hypot of the rounded differences lies at or below the threshold, where the exact distance exceeds it".
- 1 is a move whose exact distance is at most 4 where `Math.hypot` answers more, so draw makes the press a drag and the session keeps it a click: the reason "Math.hypot of the rounded differences lies above the threshold, where the exact distance is at most it".

Six of them come from the general family, where a subnormal coordinate or a difference of about 10^-18 is lost in `Math.hypot`'s rounding: a press at `(0, 5e-324)` and a move to `(4, 1e-323)`, exactly beyond, is a click to draw.\
These are the press points within the exact band the design's section 6.3 names as changed by its D7; the test holds the session to `exact` at each, and checks that every other answer that differs follows from a listed point.

The file names no word of draw's vocabulary, which its test confirms with the vocabulary check's list, and none of draw's guard, state, claim or gesture names.\
`Math.hypot` and its rounding are JavaScript's, measured at generation in the V8 of Node.js v24.12.0, which ran the generator; the test never calls it, so an engine that rounds differently still reads the same corpus.
