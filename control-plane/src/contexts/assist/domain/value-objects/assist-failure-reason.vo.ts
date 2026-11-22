/**
 * Why a session ended without a result: no runner can start the base run's harness, the base run is not in the
 * session's workspace, the session's run failed or was refused, or it ended without submitting a result.
 */
export const ASSIST_FAILURE_REASONS = [
  'no-harness',
  'base-run-elsewhere',
  'run-failed',
  'no-result',
] as const;

export type AssistFailureReason = (typeof ASSIST_FAILURE_REASONS)[number];

export const isAssistFailureReason = (
  raw: string,
): raw is AssistFailureReason =>
  (ASSIST_FAILURE_REASONS as readonly string[]).includes(raw);
