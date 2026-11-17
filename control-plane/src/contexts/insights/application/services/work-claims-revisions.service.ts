import { JudgingError } from '@insights/application/errors/judging.error';
import type {
  ClaimsDrafterPort,
  DisagreementCase,
} from '@insights/application/ports/claims-drafter.port';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type { JudgePort } from '@insights/application/ports/judge.port';
import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import type { LabelledRuns } from '@insights/application/services/labelled-runs.service';
import type { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import type { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { ClaimsRevisionVersionConflictError } from '@insights/domain/exceptions/claims-revision-version-conflict.error';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { groundedVerdict } from '@insights/domain/services/grounded-verdict';
import { JudgeEvidence } from '@insights/domain/services/judge-evidence';
import {
  beatsLiveJudge,
  bestCandidateOf,
  type CandidateVerdicts,
  candidateCountWithin,
  type LabelledRun,
  MAX_CANDIDATES,
} from '@insights/domain/services/revision-pick';
import {
  MIN_HELD_OUT,
  revisionSplitOf,
} from '@insights/domain/services/revision-split';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';

const MAX_REVISED_AT_ONCE = 1;

const JUDGED_AT_ONCE = 6;

export interface ClaimsRevisionSources {
  readonly revisions: ClaimsRevisionRepository;
  readonly disagreements: JudgeDisagreementRepository;
  readonly labelled: LabelledRuns;
  readonly judges: StationJudgesPort;
  readonly evidence: EvidencePort;
  readonly judge: JudgePort;
  readonly drafter: ClaimsDrafterPort;
}

const caseOf = (disagreement: JudgeDisagreement): DisagreementCase[] =>
  disagreement.state === 'answered'
    ? [
        {
          direction: disagreement.direction,
          claimResults: disagreement.verdict.claimResults,
          reasons: disagreement.verdict.reasons.map((each) => ({
            claim: each.claim,
            text: each.text,
          })),
          answers: disagreement.claimAnswers.map((each) => ({
            claim: each.claim,
            answer: each.answer,
            note: each.note,
          })),
          note: disagreement.notMet?.note ?? null,
          shouldHaveFailed: disagreement.notMet?.shouldHaveFailed ?? null,
        },
      ]
    : [];

const candidatesOf = (
  drafted: readonly (readonly string[])[],
  live: JudgeCriteria,
): readonly JudgeCriteria[] =>
  drafted
    .flatMap((claims) => {
      const criteria = JudgeCriteria.readable({
        claims,
        passThreshold: live.passThreshold,
      });

      return criteria && !criteria.equals(live) ? [criteria] : [];
    })
    .filter((each, at, all) => all.findIndex((one) => one.equals(each)) === at);

const inBatches = async <T>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<void>,
): Promise<void> => {
  for (let at = 0; at < items.length; at += size) {
    await Promise.all(items.slice(at, at + size).map(work));
  }
};

export class WorkClaimsRevisions implements PendingJobsPort {
  readonly name = 'Revising judge claims';

  readonly #loop: JobLoop<ClaimsRevision, ClaimsRevisionId>;

  constructor(
    private readonly sources: ClaimsRevisionSources,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<ClaimsRevision, ClaimsRevisionId>(
      {
        name: this.name,
        batchSize: MAX_REVISED_AT_ONCE,
        due: (now) => this.sources.revisions.nextDueJob(now),
        find: (id) => this.sources.revisions.find(id),
        save: (revision) => this.sources.revisions.save(revision),
        keyOf: (revision) => revision.id,
        ids: (revision) => ({
          workspaceId: revision.station.workspaceId.value,
          stationId: revision.station.stationId.value,
        }),
        about: (revision) => ({
          attempts: revision.job?.attempts,
          trigger: revision.trigger,
        }),
        process: (revision) => this.revised(revision),
        stale: (error) => error instanceof ClaimsRevisionVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async revised(revision: ClaimsRevision): Promise<ClaimsRevision> {
    const { station, rubric } = revision;
    const ended = (
      reason: Parameters<ClaimsRevision['ended']>[0]['reason'],
      more: {
        agreement?: CandidateAgreement;
        message?: string;
      } = {},
      from: ClaimsRevision = revision,
    ) =>
      from.ended({
        reason,
        agreement: more.agreement ?? null,
        message: more.message ?? null,
        now: this.clock.now(),
      });
    const judge = await this.sources.judges.judgeAt(station.stationId);

    if (!judge || judge.rubricVersion !== rubric.version) {
      return ended('judge-changed');
    }

    const split = revisionSplitOf(
      await this.sources.labelled.of(station, rubric.version),
    );

    if (split.heldOut.length < MIN_HELD_OUT) {
      return ended('too-few-labelled-runs');
    }

    const disagreements = await this.sources.disagreements.answeredAt({
      stationId: station.stationId,
      rubricVersion: rubric.version,
      since: null,
    });
    const runs = [...split.searched, ...split.heldOut];
    const drafted = (await this.sources.drafter.availableTo(
      station.workspaceId.value,
    ))
      ? await this.sources.drafter.drafted({
          workspaceId: station.workspaceId.value,
          claims: rubric.claims,
          passThreshold: rubric.passThreshold,
          cases: disagreements.flatMap(caseOf),
          maxCandidates: MAX_CANDIDATES,
        })
      : [];
    const evidence = await this.evidenceOf(runs);
    const judged = runs.filter((each) => evidence.has(each.runId.value));
    const all = candidatesOf(drafted, rubric.criteria);
    const candidates = all.slice(
      0,
      candidateCountWithin(judged.length, all.length, revision.judgeCallsLeft),
    );

    if (all.length === 0) {
      return ended('no-candidates');
    }
    if (candidates.length === 0) {
      return ended('judge-call-ceiling');
    }

    const spending = await this.spent(
      revision,
      candidates.length * judged.length,
    );
    const verdicts: CandidateVerdicts[] = [];

    for (const criteria of candidates) {
      const passes = new Map<string, boolean>();

      await inBatches(judged, JUDGED_AT_ONCE, async (run) => {
        const verdict = await this.passesOf(
          station.workspaceId.value,
          criteria,
          evidence.get(run.runId.value) as JudgeEvidence,
        );

        if (verdict !== null) {
          passes.set(run.runId.value, verdict);
        }
      });
      verdicts.push({ claims: criteria.claims, passes });
    }

    const best = bestCandidateOf(split, verdicts);

    if (!best || !beatsLiveJudge(best.agreement)) {
      return ended(
        'no-gain',
        best ? { agreement: best.agreement } : {},
        spending,
      );
    }

    return spending.picked({ pick: best, now: this.clock.now() });
  }

  private spent(
    revision: ClaimsRevision,
    judgeCalls: number,
  ): Promise<ClaimsRevision> {
    return this.saved(revision.spending(judgeCalls));
  }

  private async saved(revision: ClaimsRevision): Promise<ClaimsRevision> {
    await this.sources.revisions.save(revision);

    const found = await this.sources.revisions.find(revision.id);

    if (!found) {
      throw new ClaimsRevisionVersionConflictError(revision.id.value);
    }

    return found;
  }

  private async evidenceOf(
    runs: readonly LabelledRun[],
  ): Promise<ReadonlyMap<string, JudgeEvidence>> {
    const found = new Map<string, JudgeEvidence>();

    for (const { runId } of runs) {
      const run = await this.sources.evidence.of(runId);
      const evidence = run
        ? JudgeEvidence.of({
            runId,
            title: run.title,
            description: run.description,
            steps: run.steps,
            hunks: run.hunks,
          })
        : null;

      if (evidence && !evidence.isEmpty) {
        found.set(runId.value, evidence);
      }
    }

    return found;
  }

  private async passesOf(
    workspaceId: string,
    criteria: JudgeCriteria,
    evidence: JudgeEvidence,
  ): Promise<boolean | null> {
    try {
      const { verdict } = await this.sources.judge.judge({
        workspaceId,
        claims: criteria.claims,
        title: evidence.title,
        description: evidence.description,
        steps: evidence.steps,
        stepsLeftOut: evidence.stepsLeftOut,
        hunks: evidence.hunks,
        hunksLeftOut: evidence.hunksLeftOut,
        reference: null,
        guidanceRequested: false,
        effectsBlocked: false,
      });
      const grounded = groundedVerdict(criteria, verdict, evidence);

      return grounded.grounded ? criteria.passes(grounded.claimResults) : null;
    } catch (error) {
      if (error instanceof JudgingError) {
        return null;
      }
      throw error;
    }
  }
}

type CandidateAgreement = NonNullable<
  ReturnType<typeof bestCandidateOf>
>['agreement'];
