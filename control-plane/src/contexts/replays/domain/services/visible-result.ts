import {
  type EntryReason,
  isVerifierReason,
} from '@replays/domain/value-objects/entry-reason';
import type { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { nonEmpty } from '@shared-kernel/domain/non-empty';

export const DEFAULT_GUIDANCE =
  'The judge found the change falls short of what the task needed.';

const visibleReasonOf = (reason: EntryReason): string =>
  nonEmpty(reason.detail) && !isVerifierReason(reason.code)
    ? `${reason.code}: ${reason.detail}`
    : reason.code;

export const visibleReasonsOf = (
  reasons: readonly EntryReason[],
): readonly string[] => [...new Set(reasons.map(visibleReasonOf))];

export const visibleGuidanceOf = (
  verdict: JudgeVerdict | null,
): string | null =>
  verdict && !verdict.passes ? (verdict.guidance ?? DEFAULT_GUIDANCE) : null;
