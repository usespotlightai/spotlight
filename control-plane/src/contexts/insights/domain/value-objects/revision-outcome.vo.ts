import { InvalidClaimsRevisionError } from '@insights/domain/exceptions/invalid-claims-revision.error';
import type { RevisionAgreement } from '@insights/domain/services/revision-pick';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

export const REVISION_END_REASONS = [
  'too-few-labelled-runs',
  'no-candidates',
  'judge-call-ceiling',
  'no-gain',
  'judge-changed',
  'pull-request-failed',
  'interrupted',
  'unavailable',
] as const;

export type RevisionEndReason = (typeof REVISION_END_REASONS)[number];

export const REVISION_OUTCOME_KINDS = ['proposed', 'ended'] as const;

export type RevisionOutcomeKind = (typeof REVISION_OUTCOME_KINDS)[number];

const MAX_MESSAGE_CHARS = 1_000;

export class RevisionOutcome {
  private constructor(
    readonly kind: RevisionOutcomeKind,
    readonly reason: RevisionEndReason | null,
    readonly claims: readonly string[] | null,
    readonly pullRequest: string | null,
    readonly agreement: RevisionAgreement | null,
    readonly message: string | null,
  ) {}

  static proposed(input: {
    claims: readonly string[];
    pullRequest: string;
    agreement: RevisionAgreement;
  }): RevisionOutcome {
    if (!JudgeCriteria.readable({ claims: input.claims })) {
      throw new InvalidClaimsRevisionError('proposes a readable claims list');
    }
    if (!input.pullRequest.trim()) {
      throw new InvalidClaimsRevisionError('proposes through a pull request');
    }

    return new RevisionOutcome(
      'proposed',
      null,
      input.claims.map((each) => each.trim()),
      input.pullRequest,
      input.agreement,
      null,
    );
  }

  static ended(input: {
    reason: RevisionEndReason;
    agreement?: RevisionAgreement | null;
    message?: string | null;
  }): RevisionOutcome {
    return new RevisionOutcome(
      'ended',
      input.reason,
      null,
      null,
      input.agreement ?? null,
      input.message?.slice(0, MAX_MESSAGE_CHARS) ?? null,
    );
  }

  static rehydrate(input: {
    kind: RevisionOutcomeKind;
    reason: RevisionEndReason | null;
    claims: readonly string[] | null;
    pullRequest: string | null;
    agreement: RevisionAgreement | null;
    message: string | null;
  }): RevisionOutcome {
    return input.kind === 'proposed'
      ? RevisionOutcome.proposed({
          claims: input.claims ?? [],
          pullRequest: input.pullRequest ?? '',
          agreement: input.agreement as RevisionAgreement,
        })
      : RevisionOutcome.ended({
          reason: input.reason ?? 'interrupted',
          agreement: input.agreement,
          message: input.message,
        });
  }
}
