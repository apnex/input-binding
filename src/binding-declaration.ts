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
import { arrayProperty, dataValue, judgeRecord, recordProperty, type JudgedRecord, type OwnProperty } from "./reflection.js";
import type { BindingClaim, BindingGuard, BindingOpens, GuardRefusal } from "./types.js";

/** One row as the table holds it: what composition read of it, once, and the row itself (IB4). */
export interface CheckedRow {
	readonly id: string;
	readonly owner: string;
	readonly on: (fact: unknown) => unknown;
	readonly when: ((context: unknown) => unknown) | null;
	/** Each guard's flag, in the guards' order, the declared default where the row omits it. */
	readonly guardFlags: readonly boolean[];
	/** The claim flag, the declared default where the row omits it; false when no claim is declared. */
	readonly claims: boolean;
	readonly opens: string | null;
	readonly row: object;
}

/** A declaration with no problem: the parts a table is made of. */
export interface CheckedBindingDeclaration {
	readonly ok: true;
	readonly guards: readonly BindingGuard[];
	readonly claim: BindingClaim | null;
	readonly opens: BindingOpens | null;
	readonly rows: readonly CheckedRow[];
}

const DECLARATION_FORM = ["guards", "claim", "opens", "tenants"];
const GUARD_FORM = ["state", "flag", "default", "refuses"];
const CLAIM_FORM = ["flag", "default"];
const OPENS_FORM = ["field"];
const TENANT_FORM = ["owner", "rows"];
const ROW_FORM = ["id", "on", "when"];
const RESERVED_FIELDS: ReadonlySet<string> = new Set(ROW_FORM);
const REFUSALS: ReadonlySet<string> = new Set<GuardRefusal>(["state-and-flag", "state-without-flag", "flag-without-state"]);

const isName = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isFieldName = (value: unknown): value is string => isName(value) && !RESERVED_FIELDS.has(value);
const isFunction = (value: unknown): value is (argument: unknown) => unknown => typeof value === "function";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

/** Valid at its own pointer: a data property whose value passes the test. */
const holds = (property: OwnProperty | undefined, test: (value: unknown) => boolean): boolean => property !== undefined && property.data && test(property.value);

/** Reports, for a record judged at its pointer, every key its form does not name and every named key it lacks. */
function reportMembers(record: JudgedRecord, pointer: string, required: readonly string[], problems: ProblemList): void {
	for (const name of record.unknown) problems.add(childPointer(pointer, name), "unknown-property");
	for (const name of required) if (!record.properties.has(name)) problems.add(childPointer(pointer, name), "missing-property");
}

/** Reports a present property that fails its test as `invalid-value` at its pointer; answers whether it is valid. */
function checkMember(record: JudgedRecord, pointer: string, name: string, test: (value: unknown) => boolean, problems: ProblemList): boolean {
	const property = record.properties.get(name);
	if (property === undefined) return false;
	if (holds(property, test)) return true;
	problems.add(childPointer(pointer, name), "invalid-value");
	return false;
}

/** Step 3, one guard: its parts where each is valid at its own pointer. */
function checkGuard(value: unknown, pointer: string, problems: ProblemList): Partial<BindingGuard> & { readonly flagValid: boolean } {
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
		state: dataValue(record.properties.get("state")) as string,
		flag: dataValue(record.properties.get("flag")) as string,
		default: dataValue(record.properties.get("default")) as boolean,
		refuses: dataValue(record.properties.get("refuses")) as GuardRefusal,
		flagValid,
	};
}

/** Steps 4 and 5: a plain object of exactly the named members, each checked; null when it is not a plain object. */
function checkSmallRecord(property: OwnProperty, pointer: string, form: readonly string[], tests: Readonly<Record<string, (value: unknown) => boolean>>, problems: ProblemList): { readonly record: JudgedRecord; readonly valid: ReadonlySet<string> } | null {
	const record = recordProperty(property, form);
	if (record === null) {
		problems.add(pointer, "not-an-object");
		return null;
	}
	reportMembers(record, pointer, form, problems);
	const valid = new Set<string>();
	for (const name of form) {
		const test = tests[name];
		if (test !== undefined && checkMember(record, pointer, name, test, problems)) valid.add(name);
	}
	return { record, valid };
}

/** IB3: every problem a table's declaration has, or the parts of its table. */
export function checkBindingDeclaration(declaration: unknown): CheckedBindingDeclaration | { readonly ok: false; readonly problems: ProblemList } {
	const problems = new ProblemList();

	// steps 1 and 2: the declaration itself
	const root = judgeRecord(declaration, DECLARATION_FORM);
	if (root.refused !== false) {
		problems.add("", "not-an-object");
		return { ok: false, problems };
	}
	for (const name of root.unknown) problems.add(childPointer("", name), "unknown-property");
	if (!root.properties.has("tenants")) problems.add("/tenants", "missing-property");

	// step 3: guards
	const guardParts: (Partial<BindingGuard> & { readonly flagValid: boolean })[] = [];
	const guardsProperty = root.properties.get("guards");
	if (guardsProperty !== undefined) {
		const elements = arrayProperty(guardsProperty);
		if (elements === null) problems.add("/guards", "invalid-value");
		else elements.forEach((element, k) => guardParts.push(checkGuard(element, childPointer("/guards", k), problems)));
	}

	// step 4: claim
	const claimProperty = root.properties.get("claim");
	const claimChecked = claimProperty === undefined ? undefined : checkSmallRecord(claimProperty, "/claim", CLAIM_FORM, { flag: isFieldName, default: isBoolean }, problems);

	// step 5: opens
	const opensProperty = root.properties.get("opens");
	const opensChecked = opensProperty === undefined ? undefined : checkSmallRecord(opensProperty, "/opens", OPENS_FORM, { field: isFieldName }, problems);

	// step 6: the row-property names, each judged at its own pointer, whatever its siblings
	const fieldNames: { readonly name: string; readonly pointer: string }[] = [];
	guardParts.forEach((guard, k) => {
		if (guard.flagValid) fieldNames.push({ name: guard.flag as string, pointer: `/guards/${k}/flag` });
	});
	if (claimChecked?.valid.has("flag")) fieldNames.push({ name: dataValue(claimChecked.record.properties.get("flag")) as string, pointer: "/claim/flag" });
	if (opensChecked?.valid.has("field")) fieldNames.push({ name: dataValue(opensChecked.record.properties.get("field")) as string, pointer: "/opens/field" });
	const seenFields = new Set<string>();
	for (const { name, pointer } of fieldNames) {
		if (seenFields.has(name)) problems.add(pointer, "duplicate-field");
		else seenFields.add(name);
	}

	// step 9 runs only when nothing lies at or beneath /guards, /claim or /opens; its names are then valid and distinct
	const stepNineRuns = !problems.hasAtOrBeneath("/guards") && !problems.hasAtOrBeneath("/claim") && !problems.hasAtOrBeneath("/opens");
	const guardFlagNames = stepNineRuns ? guardParts.map((g) => g.flag as string) : [];
	const claimFlag = stepNineRuns && claimChecked ? (dataValue(claimChecked.record.properties.get("flag")) as string) : null;
	const opensField = stepNineRuns && opensChecked ? (dataValue(opensChecked.record.properties.get("field")) as string) : null;
	const rowForm = stepNineRuns ? [...ROW_FORM, ...guardFlagNames, ...(claimFlag === null ? [] : [claimFlag]), ...(opensField === null ? [] : [opensField])] : ROW_FORM;

	// steps 7 to 9: tenants and their rows
	const guards: BindingGuard[] = stepNineRuns ? guardParts.map((g) => ({ state: g.state as string, flag: g.flag as string, default: g.default as boolean, refuses: g.refuses as GuardRefusal })) : [];
	const claimDefault = stepNineRuns && claimChecked ? (dataValue(claimChecked.record.properties.get("default")) as boolean) : false;
	const rows: CheckedRow[] = [];
	const ids: { readonly id: string; readonly pointer: string }[] = [];
	const tenantsProperty = root.properties.get("tenants");
	const tenants = tenantsProperty === undefined ? [] : arrayProperty(tenantsProperty);
	if (tenants === null) problems.add("/tenants", "invalid-value");
	(tenants ?? []).forEach((tenant, i) => {
		const tenantPointer = childPointer("/tenants", i);
		const record = judgeRecord(tenant, TENANT_FORM);
		if (record.refused !== false) {
			problems.add(tenantPointer, "not-an-object");
			return;
		}
		reportMembers(record, tenantPointer, TENANT_FORM, problems);
		checkMember(record, tenantPointer, "owner", isName, problems);
		const owner = dataValue(record.properties.get("owner")) as string;
		const rowsProperty = record.properties.get("rows");
		if (rowsProperty === undefined) return;
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
			for (const name of ["id", "on"]) if (!row.properties.has(name)) problems.add(childPointer(rowPointer, name), "missing-property");
			const idValid = checkMember(row, rowPointer, "id", isName, problems);
			checkMember(row, rowPointer, "on", isFunction, problems);
			checkMember(row, rowPointer, "when", isFunction, problems);
			if (idValid) ids.push({ id: dataValue(row.properties.get("id")) as string, pointer: childPointer(rowPointer, "id") });
			// step 9: the declared flags and the opens field, under their names alone
			for (const name of guardFlagNames) checkMember(row, rowPointer, name, isBoolean, problems);
			if (claimFlag !== null) checkMember(row, rowPointer, claimFlag, isBoolean, problems);
			if (opensField !== null) checkMember(row, rowPointer, opensField, isName, problems);
			if (!stepNineRuns) return;
			const flagOf = (name: string, fallback: boolean): boolean => (row.properties.has(name) ? (dataValue(row.properties.get(name)) as boolean) : fallback);
			const when = dataValue(row.properties.get("when"));
			rows.push({
				id: dataValue(row.properties.get("id")) as string,
				owner,
				on: dataValue(row.properties.get("on")) as (fact: unknown) => unknown,
				when: row.properties.has("when") ? (when as (context: unknown) => unknown) : null,
				guardFlags: guards.map((guard) => flagOf(guard.flag, guard.default)),
				claims: claimFlag === null ? false : flagOf(claimFlag, claimDefault),
				opens: opensField !== null && row.properties.has(opensField) ? (dataValue(row.properties.get(opensField)) as string) : null,
				row: element as object,
			});
		});
	});

	// step 10: an id taken by an earlier row
	const seenIds = new Set<string>();
	for (const { id, pointer } of ids) {
		if (seenIds.has(id)) problems.add(pointer, "duplicate-id");
		else seenIds.add(id);
	}

	if (problems.size > 0) return { ok: false, problems };
	return {
		ok: true,
		guards,
		claim: claimChecked ? { flag: claimFlag as string, default: claimDefault } : null,
		opens: opensChecked ? { field: opensField as string } : null,
		rows,
	};
}
