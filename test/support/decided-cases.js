// decided-cases - IB11's decided cases (I15, I19): each a sequence on a session declaring g0, g3 and gnull,
// facts carrying no pointerId but in the last, with the phase the closing release makes due under 0.1.0 and
// under 0.2.0, as the release rule's case table gives them. A chord's presses and releases after the first
// arrive as moves, each naming the button that changed and the buttons then held, which binding never reads.

/** The gestures the decided cases declare: g0 and g3 declaring buttons 0 and 3, gnull declaring none. */
export const DECIDED_GESTURES = [
	{ name: "g0", engaged: true, button: 0 },
	{ name: "g3", engaged: true, button: 3 },
	{ name: "gnull", engaged: true, button: null },
];
const at = { x: 0, y: 0 };
const chordMove = (button, buttons) => ({ kind: "move", fact: { at, button, buttons } });
/** Each case: its label, its steps, and the phase the closing release makes due under 0.1.0 and under 0.2.0. */
export const DECIDED_CASES = [
	["down 0 opening g0; up 0", [{ kind: "down", fact: { at, button: 0 } }, { kind: "matched", opens: "g0" }, { kind: "up", fact: { button: 0 } }], "commit", "commit"],
	["down 0 opening g0; the right button pressed and the left released, as moves; up 2", [{ kind: "down", fact: { at, button: 0 } }, { kind: "matched", opens: "g0" }, chordMove(2, 3), chordMove(0, 2), { kind: "up", fact: { button: 2 } }], null, "commit"],
	["down 0 opening g0; the right button pressed and released, as moves; up 0", [{ kind: "down", fact: { at, button: 0 } }, { kind: "matched", opens: "g0" }, chordMove(2, 3), chordMove(2, 1), { kind: "up", fact: { button: 0 } }], "commit", "commit"],
	["down 3 opening g3; the left button pressed and button 3 released, as moves; up 0", [{ kind: "down", fact: { at, button: 3 } }, { kind: "matched", opens: "g3" }, chordMove(0, 5), chordMove(3, 1), { kind: "up", fact: { button: 0 } }], null, "commit"],
	["g0 started with no press; down 3, not taken; up 0", [{ kind: "start", gesture: "g0" }, { kind: "down", fact: { at, button: 3 } }, { kind: "up", fact: { button: 0 } }], "commit", "commit"],
	["g0 started with no press; down 3; up 3", [{ kind: "start", gesture: "g0" }, { kind: "down", fact: { at, button: 3 } }, { kind: "up", fact: { button: 3 } }], null, null],
	["g0 started with no press; down 0, taken; up 0", [{ kind: "start", gesture: "g0" }, { kind: "down", fact: { at, button: 0 } }, { kind: "up", fact: { button: 0 } }], "commit", "commit"],
	["gnull started; down 2; up 2", [{ kind: "start", gesture: "gnull" }, { kind: "down", fact: { at, button: 2 } }, { kind: "up", fact: { button: 2 } }], "commit", "commit"],
	["down 0 of pointer 7 opening g0; up 2 of pointer 1", [{ kind: "down", fact: { at, button: 0, pointerId: 7 } }, { kind: "matched", opens: "g0" }, { kind: "up", fact: { button: 2, pointerId: 1 } }], null, null],
];

/** Runs one decided case on a session; answers the closing release's outcome and the state before it. */
export function runDecidedCase(session, steps) {
	let before = null;
	let last = null;
	for (const step of steps) {
		before = session.state;
		if (step.kind === "down") last = session.pointerDown(step.fact);
		else if (step.kind === "matched") last = session.pressMatched({ id: "r", opens: step.opens });
		else if (step.kind === "move") last = session.pointerMove(step.fact);
		else if (step.kind === "up") last = session.pointerUp(step.fact);
		else if (step.kind === "start") last = session.startGesture({ gesture: step.gesture });
	}
	return { outcome: last, before };
}
