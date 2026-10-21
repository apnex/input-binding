// lifecycle-model - IB10's press and IB11's tables stated again, plainly, as a reference for generated
// sequences of operations (I10): the press decided by the exact oracle, every transition one row of a
// table. It shares no code with input-binding.
import { oracleBeyond } from "./travel-oracle.js";

export const initialModel = () => ({ press: null, gesture: null });

const restart = (press, from) => (press === null || from === undefined ? press : { x: from.x + 0, y: from.y + 0, beyond: false, unmatched: press.unmatched });

/**
 * One operation applied to a model: `{ refused: true }` for an operation the lifecycle does not allow,
 * or the model it leaves, the phase it makes due, the gesture that phase concerns, and the outcome's
 * further field. An operation is { kind, ... }: down { x, y, button }, move { x, y }, up { button },
 * lost, matched { id, opens }, start { gesture, row?, from? }, become { gesture, from? }, cancel.
 */
export function modelStep(model, declaration, op) {
	const declared = (name) => declaration.gestures.find((g) => g.name === name);
	const { press, gesture } = model;
	switch (op.kind) {
		case "down": {
			const taken = gesture !== null && declared(gesture.name).button !== null && declared(gesture.name).button === op.button;
			return { model: { press: { x: op.x + 0, y: op.y + 0, beyond: false, unmatched: !taken }, gesture }, phase: null, gesture: null, extra: { taken } };
		}
		case "matched": {
			if (press === null || !press.unmatched) return { refused: true };
			if (gesture !== null) return { model: { press, gesture: null }, phase: "cancel", gesture };
			if (op.opens === null) return { model: { press: { ...press, unmatched: false }, gesture: null }, phase: null, gesture: null, extra: {} };
			const started = { name: op.opens, row: op.id, engaged: declared(op.opens).engaged };
			return { model: { press: { ...press, unmatched: false }, gesture: started }, phase: "start", gesture: started, extra: {} };
		}
		case "move": {
			const crossed = press !== null && !press.beyond && oracleBeyond(press.x, press.y, op.x, op.y, declaration.threshold);
			return { model: { press: crossed ? { ...press, beyond: true } : press, gesture }, phase: gesture === null ? null : "update", gesture, extra: { crossed } };
		}
		case "up": {
			const trigger = press !== null && press.beyond ? "drop" : "click";
			const commits = gesture !== null && (declared(gesture.name).button === null || declared(gesture.name).button === op.button);
			return { model: { press: null, gesture: commits ? null : gesture }, phase: commits ? "commit" : null, gesture: commits ? gesture : null, extra: { trigger } };
		}
		case "lost":
			return { model: { press: null, gesture: null }, phase: gesture === null ? null : "cancel", gesture, extra: {} };
		case "start": {
			if (gesture !== null) return { refused: true };
			const started = { name: op.gesture, row: op.row ?? null, engaged: declared(op.gesture).engaged };
			return { model: { press: restart(press, op.from), gesture: started }, phase: "start", gesture: started, extra: {} };
		}
		case "become": {
			if (gesture === null) return { refused: true };
			const become = { name: op.gesture, row: gesture.row, engaged: declared(op.gesture).engaged };
			return { model: { press: restart(press, op.from), gesture: become }, phase: "become", gesture: become, extra: { was: gesture } };
		}
		case "cancel":
			return gesture === null ? { model, phase: null, gesture: null, extra: {} } : { model: { press, gesture: null }, phase: "cancel", gesture, extra: {} };
		default:
			throw new Error(`lifecycle-model: no operation ${op.kind}`);
	}
}

/** Applies an operation to a session, as the model states it. */
export function applyToSession(session, op) {
	switch (op.kind) {
		case "down":
			return session.pointerDown({ at: { x: op.x, y: op.y }, button: op.button });
		case "matched":
			return session.pressMatched({ id: op.id, opens: op.opens });
		case "move":
			return session.pointerMove({ at: { x: op.x, y: op.y } });
		case "up":
			return session.pointerUp({ button: op.button });
		case "lost":
			return session.pointerLost();
		case "start":
			return session.startGesture({ gesture: op.gesture, ...(op.row === undefined ? {} : { row: op.row }), ...(op.from === undefined ? {} : { from: op.from }) });
		case "become":
			return session.becomeGesture({ gesture: op.gesture, ...(op.from === undefined ? {} : { from: op.from }) });
		case "cancel":
			return session.cancelGesture();
		default:
			throw new Error(`lifecycle-model: no operation ${op.kind}`);
	}
}

/** A session's state in the model's shape. */
export const modelOf = (state) => ({ press: state.press === null ? null : { x: state.press.at.x, y: state.press.at.y, beyond: state.press.beyond, unmatched: state.press.unmatched }, gesture: state.gesture === null ? null : { ...state.gesture } });
