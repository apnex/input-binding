/**
 * A table's declaration, checked (CONTRACT.md, IB3): every problem it has, each at its pointer, or the
 * parts a table is made of.
 *
 * The declaration is read whole, value by value, in IB2's order: the declaration; its guards, each
 * guard's state, flag, default and refuses; its claim's flag and default; its opens's field; its tenants,
 * each tenant's owner and rows, and each row's id, on and when, then -- when step 9 runs -- each guard's
 * flag in order, the claim's flag and the opens field. Each value is judged at its own pointer before
 * anything beneath it is read (src/reflection.ts), and nothing beneath a value refused there is read.
 * A row's other properties are its application's payload and are never inspected.
 */
import { childPointer, ProblemList } from "./declaration-problems.js";
import { arrayProperty, dataValue, judgeRecord, recordProperty } from "./reflection.js";
const DECLARATION_FORM = ["guards", "claim", "opens", "tenants"];
const GUARD_FORM = ["state", "flag", "default", "refuses"];
const CLAIM_FORM = ["flag", "default"];
const OPENS_FORM = ["field"];
const TENANT_FORM = ["owner", "rows"];
const ROW_FORM = ["id", "on", "when"];
const RESERVED_FIELDS = new Set(ROW_FORM);
const REFUSALS = new Set(["state-and-flag", "state-without-flag", "flag-without-state"]);
const isName = (value) => typeof value === "string" && value.length > 0;
const isFieldName = (value) => isName(value) && !RESERVED_FIELDS.has(value);
const isFunction = (value) => typeof value === "function";
const isBoolean = (value) => typeof value === "boolean";
/** Valid at its own pointer: a data property whose value passes the test. */
const holds = (property, test) => property !== undefined && property.data && test(property.value);
/** Reports, for a record judged at its pointer, every key its form does not name and every named key it lacks. */
function reportMembers(record, pointer, required, problems) {
    for (const name of record.unknown)
        problems.add(childPointer(pointer, name), "unknown-property");
    for (const name of required)
        if (!record.properties.has(name))
            problems.add(childPointer(pointer, name), "missing-property");
}
/** Reports a present property that fails its test as `invalid-value` at its pointer; answers whether it is valid. */
function checkMember(record, pointer, name, test, problems) {
    const property = record.properties.get(name);
    if (property === undefined)
        return false;
    if (holds(property, test))
        return true;
    problems.add(childPointer(pointer, name), "invalid-value");
    return false;
}
/** Step 3, one guard: its parts where each is valid at its own pointer. */
function checkGuard(value, pointer, problems) {
    const record = judgeRecord(value, GUARD_FORM);
    if (record.refused !== false) {
        problems.add(pointer, "not-an-object");
        return { flagValid: false };
    }
    reportMembers(record, pointer, GUARD_FORM, problems);
    checkMember(record, pointer, "state", isName, problems);
    const flagValid = checkMember(record, pointer, "flag", isFieldName, problems);
    checkMember(record, pointer, "default", isBoolean, problems);
    checkMember(record, pointer, "refuses", (v) => typeof v === "string" && REFUSALS.has(v), problems);
    return {
        state: dataValue(record.properties.get("state")),
        flag: dataValue(record.properties.get("flag")),
        default: dataValue(record.properties.get("default")),
        refuses: dataValue(record.properties.get("refuses")),
        flagValid,
    };
}
/** Steps 4 and 5: a plain object of exactly the named members, each checked; null when it is not a plain object. */
function checkSmallRecord(property, pointer, form, tests, problems) {
    const record = recordProperty(property, form);
    if (record === null) {
        problems.add(pointer, "not-an-object");
        return null;
    }
    reportMembers(record, pointer, form, problems);
    const valid = new Set();
    for (const name of form) {
        const test = tests[name];
        if (test !== undefined && checkMember(record, pointer, name, test, problems))
            valid.add(name);
    }
    return { record, valid };
}
/** IB3: every problem a table's declaration has, or the parts of its table. */
export function checkBindingDeclaration(declaration) {
    const problems = new ProblemList();
    // steps 1 and 2: the declaration itself
    const root = judgeRecord(declaration, DECLARATION_FORM);
    if (root.refused !== false) {
        problems.add("", "not-an-object");
        return { ok: false, problems };
    }
    for (const name of root.unknown)
        problems.add(childPointer("", name), "unknown-property");
    if (!root.properties.has("tenants"))
        problems.add("/tenants", "missing-property");
    // step 3: guards
    const guardParts = [];
    const guardsProperty = root.properties.get("guards");
    if (guardsProperty !== undefined) {
        const elements = arrayProperty(guardsProperty);
        if (elements === null)
            problems.add("/guards", "invalid-value");
        else
            elements.forEach((element, k) => guardParts.push(checkGuard(element, childPointer("/guards", k), problems)));
    }
    // step 4: claim
    const claimProperty = root.properties.get("claim");
    const claimChecked = claimProperty === undefined ? undefined : checkSmallRecord(claimProperty, "/claim", CLAIM_FORM, { flag: isFieldName, default: isBoolean }, problems);
    // step 5: opens
    const opensProperty = root.properties.get("opens");
    const opensChecked = opensProperty === undefined ? undefined : checkSmallRecord(opensProperty, "/opens", OPENS_FORM, { field: isFieldName }, problems);
    // step 6: the row-property names, each judged at its own pointer, whatever its siblings
    const fieldNames = [];
    guardParts.forEach((guard, k) => {
        if (guard.flagValid)
            fieldNames.push({ name: guard.flag, pointer: `/guards/${k}/flag` });
    });
    if (claimChecked?.valid.has("flag"))
        fieldNames.push({ name: dataValue(claimChecked.record.properties.get("flag")), pointer: "/claim/flag" });
    if (opensChecked?.valid.has("field"))
        fieldNames.push({ name: dataValue(opensChecked.record.properties.get("field")), pointer: "/opens/field" });
    const seenFields = new Set();
    for (const { name, pointer } of fieldNames) {
        if (seenFields.has(name))
            problems.add(pointer, "duplicate-field");
        else
            seenFields.add(name);
    }
    // step 9 runs only when nothing lies at or beneath /guards, /claim or /opens; its names are then valid and distinct
    const stepNineRuns = !problems.hasAtOrBeneath("/guards") && !problems.hasAtOrBeneath("/claim") && !problems.hasAtOrBeneath("/opens");
    const guardFlagNames = stepNineRuns ? guardParts.map((g) => g.flag) : [];
    const claimFlag = stepNineRuns && claimChecked ? dataValue(claimChecked.record.properties.get("flag")) : null;
    const opensField = stepNineRuns && opensChecked ? dataValue(opensChecked.record.properties.get("field")) : null;
    const rowForm = stepNineRuns ? [...ROW_FORM, ...guardFlagNames, ...(claimFlag === null ? [] : [claimFlag]), ...(opensField === null ? [] : [opensField])] : ROW_FORM;
    // steps 7 to 9: tenants and their rows
    const guards = stepNineRuns ? guardParts.map((g) => ({ state: g.state, flag: g.flag, default: g.default, refuses: g.refuses })) : [];
    const claimDefault = stepNineRuns && claimChecked ? dataValue(claimChecked.record.properties.get("default")) : false;
    const rows = [];
    const ids = [];
    const tenantsProperty = root.properties.get("tenants");
    const tenants = tenantsProperty === undefined ? [] : arrayProperty(tenantsProperty);
    if (tenants === null)
        problems.add("/tenants", "invalid-value");
    (tenants ?? []).forEach((tenant, i) => {
        const tenantPointer = childPointer("/tenants", i);
        const record = judgeRecord(tenant, TENANT_FORM);
        if (record.refused !== false) {
            problems.add(tenantPointer, "not-an-object");
            return;
        }
        reportMembers(record, tenantPointer, TENANT_FORM, problems);
        checkMember(record, tenantPointer, "owner", isName, problems);
        const owner = dataValue(record.properties.get("owner"));
        const rowsProperty = record.properties.get("rows");
        if (rowsProperty === undefined)
            return;
        const rowsPointer = childPointer(tenantPointer, "rows");
        const elements = arrayProperty(rowsProperty);
        if (elements === null) {
            problems.add(rowsPointer, "invalid-value");
            return;
        }
        elements.forEach((element, j) => {
            const rowPointer = childPointer(rowsPointer, j);
            const row = judgeRecord(element, rowForm);
            if (row.refused !== false) {
                problems.add(rowPointer, "not-an-object");
                return;
            }
            // step 8: id, on and when, here alone
            for (const name of ["id", "on"])
                if (!row.properties.has(name))
                    problems.add(childPointer(rowPointer, name), "missing-property");
            const idValid = checkMember(row, rowPointer, "id", isName, problems);
            checkMember(row, rowPointer, "on", isFunction, problems);
            checkMember(row, rowPointer, "when", isFunction, problems);
            if (idValid)
                ids.push({ id: dataValue(row.properties.get("id")), pointer: childPointer(rowPointer, "id") });
            // step 9: the declared flags and the opens field, under their names alone
            for (const name of guardFlagNames)
                checkMember(row, rowPointer, name, isBoolean, problems);
            if (claimFlag !== null)
                checkMember(row, rowPointer, claimFlag, isBoolean, problems);
            if (opensField !== null)
                checkMember(row, rowPointer, opensField, isName, problems);
            if (!stepNineRuns)
                return;
            const flagOf = (name, fallback) => (row.properties.has(name) ? dataValue(row.properties.get(name)) : fallback);
            const when = dataValue(row.properties.get("when"));
            rows.push({
                id: dataValue(row.properties.get("id")),
                owner,
                on: dataValue(row.properties.get("on")),
                when: row.properties.has("when") ? when : null,
                guardFlags: guards.map((guard) => flagOf(guard.flag, guard.default)),
                claims: claimFlag === null ? false : flagOf(claimFlag, claimDefault),
                opens: opensField !== null && row.properties.has(opensField) ? dataValue(row.properties.get(opensField)) : null,
                row: element,
            });
        });
    });
    // step 10: an id taken by an earlier row
    const seenIds = new Set();
    for (const { id, pointer } of ids) {
        if (seenIds.has(id))
            problems.add(pointer, "duplicate-id");
        else
            seenIds.add(id);
    }
    if (problems.size > 0)
        return { ok: false, problems };
    return {
        ok: true,
        guards,
        claim: claimChecked ? { flag: claimFlag, default: claimDefault } : null,
        opens: opensChecked ? { field: opensField } : null,
        rows,
    };
}
//# sourceMappingURL=binding-declaration.js.map