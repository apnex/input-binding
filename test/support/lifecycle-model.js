// lifecycle-model - IB10's press, IB11's tables and IB14's keys stated again, plainly, as a reference for
// generated sequences of operations (I10, I15, I16, I18): the press decided by the exact oracle, every
// transition one row of a table. It shares no code with input-binding.
import { oracleBeyond } from "./travel-oracle.js";

export const initialModel = () => ({ press: null, gesture: null, keys: [] });

const restart = (press, from) => (press === null || from === undefined ? press : { ...press, x: from.x + 0, y: from.y + 0, beyond: false });

/** A fact's pointer as IB1 reads it: absent is null; a number is written + 0. */
const pointerOf = (op) => (op.pointer === undefined || op.pointer === null ? null : op.pointer + 0);

/**
 * One operation applied to a model: `{ refused: true }` for an operation the lifecycle does not allow,
 * or the model it leaves, the phase it makes due, the gesture that phase concerns, and the outcome's
 * further fields. An operation is { kind, ... }: down { x, y, button, pointer? }, move { x, y, pointer? },
 * up { button, pointer? }, lost, matched { id, opens }, start { gesture, row?, from? }, become { gesture,
 * from? }, cancel, keyDown { code }, keyUp { code }, keysLost; `pointer` absent means the fact holds no
 * pointerId.
 */
export function modelStep(model, declaration, op) {
	const declared = (name) => declaration.gestures.find((g) => g.name === name);
	const { press, gesture, keys } = model;
	const g = gesture === null ? null : declared(gesture.name).button;
	switch (op.kind) {
		case "down": {
			const taken = gesture !== null && g !== null && g === op.button;
			return { model: { press: { x: op.x + 0, y: op.y + 0, beyond: false, unmatched: !taken, button: op.button + 0, pointer: pointerOf(op) }, gesture, keys }, phase: null, gesture: null, extra: { taken } };
		}
		case "matched": {
			if (press === null || !press.unmatched) return { refused: true };
			if (gesture !== null) return { model: { press, gesture: null, keys }, phase: "cancel", gesture };
			if (op.opens === null) return { model: { press: { ...press, unmatched: false }, gesture: null, keys }, phase: null, gesture: null, extra: {} };
			const started = { name: op.opens, row: op.id, engaged: declared(op.opens).engaged };
			return { model: { press: { ...press, unmatched: false }, gesture: started, keys }, phase: "start", gesture: started, extra: {} };
		}
		case "move": {
			if (press !== null && pointerOf(op) !== press.pointer) return { model, phase: null, gesture: null, extra: { crossed: false, otherPointer: true } };
			const crossed = press !== null && !press.beyond && oracleBeyond(press.x, press.y, op.x, op.y, declaration.threshold);
			return { model: { press: crossed ? { ...press, beyond: true } : press, gesture, keys }, phase: gesture === null ? null : "update", gesture, extra: { crossed, otherPointer: false } };
		}
		case "up": {
			if (press !== null && pointerOf(op) !== press.pointer) return { model, phase: null, gesture: null, extra: { trigger: null, otherPointer: true } };
			const trigger = press !== null && press.beyond ? "drop" : "click";
			const commits = gesture !== null && (g === null || g === op.button || (press !== null && g === press.button));
			return { model: { press: null, gesture: commits ? null : gesture, keys }, phase: commits ? "commit" : null, gesture: commits ? gesture : null, extra: { trigger, otherPointer: false } };
		}
		case "lost":
			return { model: { press: null, gesture: null, keys }, phase: gesture === null ? null : "cancel", gesture, extra: {} };
		case "start": {
			if (gesture !== null) return { refused: true };
			const started = { name: op.gesture, row: op.row ?? null, engaged: declared(op.gesture).engaged };
			return { model: { press: restart(press, op.from), gesture: started, keys }, phase: "start", gesture: started, extra: {} };
		}
		case "become": {
			if (gesture === null) return { refused: true };
			const become = { name: op.gesture, row: gesture.row, engaged: declared(op.gesture).engaged };
			return { model: { press: restart(press, op.from), gesture: become, keys }, phase: "become", gesture: become, extra: { was: gesture } };
		}
		case "cancel":
			return gesture === null ? { model, phase: null, gesture: null, extra: {} } : { model: { press, gesture: null, keys }, phase: "cancel", gesture, extra: {} };
		case "keyDown":
		case "keyUp": {
			if (op.code === null || op.code === "") return { model, key: { tracked: false, held: null } };
			const held = keys.includes(op.code);
			const next = op.kind === "keyDown" ? (held ? keys : [...keys, op.code]) : held ? keys.filter((k) => k !== op.code) : keys;
			return { model: { press, gesture, keys: next }, key: { tracked: true, held } };
		}
		case "keysLost":
			return { model: { press, gesture, keys: [] }, key: { released: keys } };
		default:
			throw new Error(`lifecycle-model: no operation ${op.kind}`);
	}
}

/** A pointer fact as the operation states it: `pointerId` only when the operation names a pointer. */
const withPointer = (fact, op) => (op.pointer === undefined ? fact : { ...fact, pointerId: op.pointer });

/** Applies an operation to a session, as the model states it. */
export function applyToSession(session, op) {
	switch (op.kind) {
		case "down":
			return session.pointerDown(withPointer({ at: { x: op.x, y: op.y }, button: op.button }, op));
		case "matched":
			return session.pressMatched({ id: op.id, opens: op.opens });
		case "move":
			return session.pointerMove(withPointer({ at: { x: op.x, y: op.y } }, op));
		case "up":
			return session.pointerUp(withPointer({ button: op.button }, op));
		case "lost":
			return session.pointerLost();
		case "start":
			return session.startGesture({ gesture: op.gesture, ...(op.row === undefined ? {} : { row: op.row }), ...(op.from === undefined ? {} : { from: op.from }) });
		case "become":
			return session.becomeGesture({ gesture: op.gesture, ...(op.from === undefined ? {} : { from: op.from }) });
		case "cancel":
			return session.cancelGesture();
		case "keyDown":
			return session.keyDown({ code: op.code });
		case "keyUp":
			return session.keyUp({ code: op.code });
		case "keysLost":
			return session.keysLost();
		default:
			throw new Error(`lifecycle-model: no operation ${op.kind}`);
	}
}

/** A session's state in the model's shape. */
export const modelOf = (state) => ({
	press: state.press === null ? null : { x: state.press.at.x, y: state.press.at.y, beyond: state.press.beyond, unmatched: state.press.unmatched, button: state.press.button, pointer: state.press.pointer },
	gesture: state.gesture === null ? null : { ...state.gesture },
	keys: [...state.keys],
});

/**
 * One operation of I10's generator, over the gestures given: the kinds weighted as the first release
 * weighted them, points from a small set so presses travel on, inside and beyond a threshold of 4.
 */
export function randomOperation({ int, pick, chance }, gestures) {
	const point = () => ({ x: pick([0, 1, 3, 4, 5, -6, 2.5]), y: pick([0, 3, -4, 0.5]) });
	const kind = pick(["down", "down", "matched", "matched", "move", "move", "move", "up", "up", "lost", "start", "become", "cancel"]);
	const op = { kind };
	if (kind === "down") Object.assign(op, point(), { button: pick([0, 0, 1, 2]) });
	if (kind === "move") Object.assign(op, point());
	if (kind === "up") op.button = pick([0, 0, 1, 2]);
	if (kind === "matched") Object.assign(op, { id: `r${int(0, 5)}`, opens: pick([null, ...gestures.map((g) => g.name)]) });
	if (kind === "start") Object.assign(op, { gesture: pick(gestures).name }, chance(0.5) ? { row: `r${int(0, 5)}` } : {}, chance(0.5) ? { from: point() } : {});
	if (kind === "become") Object.assign(op, { gesture: pick(gestures).name }, chance(0.5) ? { from: point() } : {});
	return op;
}
