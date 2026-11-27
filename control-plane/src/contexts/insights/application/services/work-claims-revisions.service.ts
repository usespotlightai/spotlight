import type {
  ClaimsDrafterPort,
  DisagreementCase,
} from '@insights/application/ports/claims-drafter.port';
import type { EvidencePort } from '@insights/application/ports/evidence.port';
import type {
  JudgeAnswer,
  JudgePort,
} from '@insights/application/ports/judge.port';
import {
  allSettled,
  type SessionFailed,
  type SessionWaiting,
  type SettledSession,
} from '@insights/application/ports/session-outcomes';
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
  revisableOf,
  revisionSplitOf,
} from '@insights/domain/services/revision-split';
import type { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { ClaimsRevisionRound } from '@insights/domain/value-objects/claims-revision-round.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

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

/** The run the drafting session starts from: the one of the newest answered disagreement, or else a labelled run. */
const draftedFrom = (
  disagreements: readonly JudgeDisagreement[],
  runs: readonly LabelledRun[],
): RunId | null => {
  const newest = disagreements.reduce<JudgeDisagreement | null>(
    (latest, each) =>
      !latest ||
      (each.answeredAt?.getTime() ?? 0) > (latest.answeredAt?.getTime() ?? 0)
        ? each
        : latest,
    null,
  );

  return newest?.runId ?? runs[0]?.runId ?? null;
};

const inBatches = async <T, R>(
  items: readonly T[],
  size: number,
  work: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  const done: R[] = [];

  for (let at = 0; at < items.length; at += size) {
    done.push(...(await Promise.all(items.slice(at, at + size).map(work))));
  }

  return done;
};

interface CandidateCall {
  readonly criteria: JudgeCriteria;
  readonly at: number;
  readonly run: LabelledRun;
  readonly evidence: JudgeEvidence;
}

export class WorkClaimsRevisions implements PendingJobsPort {
  readonly name = 'Revising judge claims';

  readonly #loop: JobLoop<ClaimsRevision, ClaimsRevisionId>;

  constructor(
    private readonly sources: ClaimsRevisionSources,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
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

  /** Makes the revision that waits on a settled session due now; a revision that moved on meanwhile is left alone. */
  async sessionSettled(session: SettledSession): Promise<void> {
    const judged = this.sources.judge.roundOf(session);
    const round =
      this.sources.drafter.roundOf(session) ??
      (judged?.of === 'candidate' ? judged.round : null);

    if (!round) {
      return;
    }

    await this.transaction.inTransaction(async () => {
      const revision = await this.sources.revisions.find(round.revisionId);

      if (
        !revision ||
        revision.station.workspaceId.value !== session.workspaceId
      ) {
        return;
      }

      const woken = revision.wake(round, this.clock.now());

      if (woken === revision) {
        return;
      }

      try {
        await this.sources.revisions.save(woken);
      } catch (error) {
        if (!(error instanceof ClaimsRevisionVersionConflictError)) {
          throw error;
        }
      }
    });
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

    if (!revisableOf(split)) {
      return ended('too-few-labelled-runs');
    }

    const disagreements = await this.sources.disagreements.answeredAt({
      stationId: station.stationId,
      rubricVersion: rubric.version,
      since: null,
    });
    const runs = [...split.searched, ...split.heldOut];
    const from = draftedFrom(disagreements, runs);

    if (!from) {
      return ended('too-few-labelled-runs');
    }

    const { round } = revision;
    const drafted = await this.sources.drafter.drafted({
      workspaceId: station.workspaceId.value,
      round,
      draftedFrom: from,
      claims: rubric.claims,
      passThreshold: rubric.passThreshold,
      cases: disagreements.flatMap(caseOf),
      maxCandidates: MAX_CANDIDATES,
    });

    switch (drafted.status) {
      case 'waiting':
        return revision.waitJob(this.clock.now());
      case 'unavailable':
        return revision.unavailable(this.clock.now());
      case 'failed':
        return revision.draftingFailed(this.clock.now());
      case 'drafted':
        break;
    }

    const evidence = await this.evidenceOf(runs);
    const judged = runs.filter((each) => evidence.has(each.runId.value));
    const all = candidatesOf(drafted.candidates, rubric.criteria);
    const candidates = all.slice(
      0,
      candidateCountWithin(
        judged.length,
        all.length,
        revision.judgeCallsLeftIn(round),
      ),
    );

    if (all.length === 0) {
      return ended('no-candidates');
    }
    if (candidates.length === 0) {
      return ended('judge-call-ceiling');
    }

    const calls: CandidateCall[] = candidates.flatMap((criteria, at) =>
      judged.flatMap((run) => {
        const found = evidence.get(run.runId.value);

        return found ? [{ criteria, at, run, evidence: found }] : [];
      }),
    );
    const reserved = await this.reserved(revision, round, calls.length);
    const answers = allSettled(
      await inBatches(calls, JUDGED_AT_ONCE, (call) =>
        this.judgedOn(station.workspaceId.value, round, call),
      ),
    );

    if ('status' in answers) {
      return reserved.waitJob(this.clock.now());
    }
    if (
      answers.some(
        (each) => each.status === 'failed' && each.failure === 'unavailable',
      )
    ) {
      return reserved.unavailable(this.clock.now());
    }

    const passes = candidates.map(() => new Map<string, boolean>());

    answers.forEach((answer, at) => {
      const call = calls[at];
      const passed =
        call && answer.status === 'judged' ? this.passes(call, answer) : null;

      if (call && passed !== null) {
        passes[call.at]?.set(call.run.runId.value, passed);
      }
    });

    const verdicts: CandidateVerdicts[] = candidates.map((criteria, at) => ({
      claims: criteria.claims,
      passes: passes[at] ?? new Map<string, boolean>(),
    }));
    const best = bestCandidateOf(split, verdicts);

    if (!best || !beatsLiveJudge(best.agreement)) {
      return ended(
        'no-gain',
        best ? { agreement: best.agreement } : {},
        reserved,
      );
    }

    return reserved.picked({ pick: best, now: this.clock.now() });
  }

  /**
   * Reserves the round's judge calls and saves them before any judging session is ordered, so a retry knows what
   * this round spent. A round asked again after a wait has reserved them already and saves nothing.
   */
  private async reserved(
    revision: ClaimsRevision,
    round: ClaimsRevisionRound,
    judgeCalls: number,
  ): Promise<ClaimsRevision> {
    const reserved = revision.reserveJudgeCalls(round, judgeCalls);

    if (reserved === revision) {
      return revision;
    }

    await this.sources.revisions.save(reserved);

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

  private judgedOn(
    workspaceId: string,
    round: ClaimsRevisionRound,
    { criteria, at, run, evidence }: CandidateCall,
  ): Promise<JudgeAnswer | SessionFailed | SessionWaiting> {
    return this.sources.judge.judge({
      workspaceId,
      round: { of: 'candidate', round, candidate: at, runId: run.runId },
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
  }

  /** Whether the run passes the candidate, or null when the verdict does not rest on the evidence. */
  private passes(
    { criteria, evidence }: CandidateCall,
    answer: JudgeAnswer,
  ): boolean | null {
    const grounded = groundedVerdict(criteria, answer.verdict, evidence);

    return grounded.grounded ? criteria.passes(grounded.claimResults) : null;
  }
}

type CandidateAgreement = NonNullable<
  ReturnType<typeof bestCandidateOf>
>['agreement'];
