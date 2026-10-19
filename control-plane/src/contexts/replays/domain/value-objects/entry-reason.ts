export const ENTRY_REASON_CODES = [
  'unreplayable',
  'not-run',
  'run-failed',
  'run-stopped',
  'asked-a-person',
  'check-failed',
  'check-skipped',
  'change-not-generated',
  'no-change',
  'no-change-stack',
  'judged',
  'judge-failed',
  'unjudged',
  'nothing-judges',
] as const;

export type EntryReasonCode = (typeof ENTRY_REASON_CODES)[number];

export interface EntryReason {
  readonly code: EntryReasonCode;
  readonly detail: string | null;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
}

export const reasonOf = (
  code: EntryReasonCode,
  detail: string | null = null,
  cited: { steps?: readonly number[]; hunks?: readonly string[] } = {},
): EntryReason => ({
  code,
  detail,
  steps: [...(cited.steps ?? [])],
  hunks: [...(cited.hunks ?? [])],
});

export const isEntryReasonCode = (raw: string): raw is EntryReasonCode =>
  (ENTRY_REASON_CODES as readonly string[]).includes(raw);

const VERIFIER_REASON_CODES: ReadonlySet<EntryReasonCode> = new Set([
  'judged',
  'judge-failed',
  'check-failed',
]);

export const isVerifierReason = (code: EntryReasonCode): boolean =>
  VERIFIER_REASON_CODES.has(code);
