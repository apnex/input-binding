/**
 * A session's declaration, checked (CONTRACT.md, IB9): every problem it has, each at its pointer, or the
 * threshold and the gestures a session is opened from.
 *
 * Read whole, value by value, in IB2's order: the declaration; its threshold; its gestures, each
 * gesture's name, engaged and button. Each value is judged at its own pointer before anything beneath it
 * is read (src/reflection.ts), so a gestures descriptor whose trap rewrites the threshold finds it read.
 */
import { childPointer, ProblemList } from "./declaration-problems.js";
import { arrayProperty, dataValue, judgeRecord } from "./reflection.js";
const DECLARATION_FORM = ["threshold", "gestures"];
const GESTURE_FORM = ["name", "engaged", "button"];
/** IB9: every problem a session's declaration has, or what a session is opened from. */
export function checkSessionDeclaration(declaration) {
    const problems = new ProblemList();
    // steps 1 and 2
    const root = judgeRecord(declaration, DECLARATION_FORM);
    if (root.refused !== false) {
        problems.add("", "not-an-object");
        return { ok: false, problems };
    }
    for (const name of root.unknown)
        problems.add(childPointer("", name), "unknown-property");
    for (const name of DECLARATION_FORM)
        if (!root.properties.has(name))
            problems.add(childPointer("", name), "missing-property");
    // step 3
    const thresholdProperty = root.properties.get("threshold");
    const threshold = dataValue(thresholdProperty);
    if (thresholdProperty !== undefined && !(thresholdProperty.data && typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0))
        problems.add("/threshold", "invalid-value");
    // step 4
    const gestures = [];
    const names = [];
    const gesturesProperty = root.properties.get("gestures");
    const elements = gesturesProperty === undefined ? [] : arrayProperty(gesturesProperty);
    if (elements === null)
        problems.add("/gestures", "invalid-value");
    (elements ?? []).forEach((element, k) => {
        const pointer = childPointer("/gestures", k);
        const record = judgeRecord(element, GESTURE_FORM);
        if (record.refused !== false) {
            problems.add(pointer, "not-an-object");
            return;
        }
        for (const name of record.unknown)
            problems.add(childPointer(pointer, name), "unknown-property");
        for (const name of GESTURE_FORM)
            if (!record.properties.has(name))
                problems.add(childPointer(pointer, name), "missing-property");
        const nameProperty = record.properties.get("name");
        const engagedProperty = record.properties.get("engaged");
        const buttonProperty = record.properties.get("button");
        const name = dataValue(nameProperty);
        const engaged = dataValue(engagedProperty);
        const button = dataValue(buttonProperty);
        const nameValid = nameProperty !== undefined && nameProperty.data && typeof name === "string" && name.length > 0;
        const engagedValid = engagedProperty !== undefined && engagedProperty.data && typeof engaged === "boolean";
        const buttonValid = buttonProperty !== undefined && buttonProperty.data && (button === null || (typeof button === "number" && Number.isSafeInteger(button)));
        if (nameProperty !== undefined && !nameValid)
            problems.add(childPointer(pointer, "name"), "invalid-value");
        if (engagedProperty !== undefined && !engagedValid)
            problems.add(childPointer(pointer, "engaged"), "invalid-value");
        if (buttonProperty !== undefined && !buttonValid)
            problems.add(childPointer(pointer, "button"), "invalid-value");
        if (nameValid)
            names.push({ name: name, pointer: childPointer(pointer, "name") });
        if (nameValid && engagedValid && buttonValid)
            gestures.push({ name: name, engaged: engaged, button: button === null ? null : button + 0 });
    });
    // step 5
    const seen = new Set();
    for (const { name, pointer } of names) {
        if (seen.has(name))
            problems.add(pointer, "duplicate-name");
        else
            seen.add(name);
    }
    if (problems.size > 0)
        return { ok: false, problems };
    return { ok: true, threshold: threshold + 0, gestures };
}
//# sourceMappingURL=session-declaration.js.map