import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import type { PullRequestRecordClosed } from '@insights/domain/events/pull-request-record-closed.event';
import type { RunOutcomeChanged } from '@insights/domain/events/run-outcome-changed.event';
import type { RunRecordEnded } from '@insights/domain/events/run-record-ended.event';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { JudgeDisagreementVersionConflictError } from '@insights/domain/exceptions/judge-disagreement-version-conflict.error';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import type { HumanLabel } from '@insights/domain/value-objects/human-label.vo';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import type { Scored } from '@insights/domain/value-objects/score-fact.vo';
import { LIVE } from '@insights/domain/value-objects/score-origin';
import type { WithdrawalReason } from '@insights/domain/value-objects/withdrawal-reason';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface JudgedLineChanged {
  readonly workspaceId: string;
  readonly deleted: boolean;
  readonly stationIds: readonly string[];
}

const WITHDRAWN_AT_ONCE = 100;

const liveJudgeOf = (
  scores: readonly Scored[],
  rubric: Rubric,
): Scored | null =>
  scores.find(
    (each) => each.origin === LIVE && each.rubricVersion === rubric.version,
  ) ?? null;

export interface Reconsidered {
  readonly runId: RunId;
  readonly workspaceId: WorkspaceId;
  readonly location: RunLocation;
}

export interface NotReconsidered {
  readonly runId: RunId;
  readonly error: unknown;
}

export class RaiseJudgeDisagreements {
  constructor(
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly facts: StationFactsPort,
    private readonly judges: StationJudgesPort,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async scoreRecorded(event: ScoreRecorded): Promise<void> {
    if (event.origin !== LIVE) {
      return;
    }

    await this.consider(event.runId, event.workspaceId, event.location);
  }

  runEnded(event: RunRecordEnded): Promise<void> {
    return this.considerTask(event.location.taskId, event.workspaceId, {
      stationId: event.location.stationId,
    });
  }

  outcomeChanged(event: RunOutcomeChanged): Promise<void> {
    return this.considerTask(event.location.taskId, event.workspaceId, {
      stationId: event.location.stationId,
    });
  }

  pullRequestClosed(event: PullRequestRecordClosed): Promise<void> {
    return this.considerTask(event.taskId, event.workspaceId, {
      stationId: null,
    });
  }

  async lineChanged(event: JudgedLineChanged): Promise<void> {
    for (const raw of event.stationIds) {
      const stationId = StationId.of(raw);
      const rubric = event.deleted ? null : await this.rubricAt(stationId);

      await this.withdrawingOutdated(stationId, rubric?.version ?? null);
    }
  }

  private async considerTask(
    taskId: TaskId,
    workspaceId: WorkspaceId,
    at: { stationId: StationId | null },
  ): Promise<void> {
    const rubricOf = this.rubricsAt();

    for (const fact of await this.facts.ofTasks([taskId])) {
      if (
        fact.workspaceId.equals(workspaceId) &&
        (at.stationId === null ||
          fact.end.location.stationId.equals(at.stationId))
      ) {
        await this.consider(
          fact.runId,
          workspaceId,
          fact.end.location,
          await rubricOf(fact.end.location.stationId),
        );
      }
    }
  }

  async reconsider(
    runs: readonly Reconsidered[],
  ): Promise<readonly NotReconsidered[]> {
    const rubricOf = this.rubricsAt();
    const failed: NotReconsidered[] = [];

    for (const run of runs) {
      try {
        await this.consider(
          run.runId,
          run.workspaceId,
          run.location,
          await rubricOf(run.location.stationId),
        );
      } catch (error) {
        failed.push({ runId: run.runId, error });
      }
    }

    return failed;
  }

  private rubricsAt(): (stationId: StationId) => Promise<Rubric | null> {
    const rubrics = new Map<string, Promise<Rubric | null>>();

    return (stationId) => {
      const rubric = rubrics.get(stationId.value) ?? this.rubricAt(stationId);
      rubrics.set(stationId.value, rubric);
      return rubric;
    };
  }

  private async consider(
    runId: RunId,
    workspaceId: WorkspaceId,
    location: RunLocation,
    judged?: Rubric | null,
  ): Promise<void> {
    const rubric =
      judged === undefined ? await this.rubricAt(location.stationId) : judged;
    const { label, scores, known } = await this.withdrawingStale(runId, rubric);

    if (
      !rubric ||
      !label ||
      !JudgeDisagreement.mayOpenBeside(known, {
        rubricVersion: rubric.version,
        labelFrom: label.from,
        askedOf: label.by,
      })
    ) {
      return;
    }

    const live = liveJudgeOf(scores, rubric);

    if (live && !label.agreesWith(live)) {
      await this.opening({ runId, workspaceId, rubric, live, label });
      await this.withdrawingStale(runId, rubric);
    }
  }

  private async withdrawingStale(
    runId: RunId,
    rubric: Rubric | null,
    retried = false,
  ): Promise<{
    label: HumanLabel | null;
    scores: readonly Scored[];
    known: readonly JudgeDisagreement[];
  }> {
    const fact = firstOf(await this.facts.ofRuns([runId]));
    const scores = await this.facts.scoresOfRuns([runId]);
    const label = fact?.humanLabel ?? null;
    const known = await this.disagreements.ofRun(runId);
    const standing = known.find((each) => !each.isWithdrawn) ?? null;
    const reason =
      standing?.noLongerHoldsBecause({
        rubricVersion: rubric?.version ?? null,
        labelFrom: label?.from ?? null,
      }) ?? null;

    if (standing && reason) {
      try {
        await this.withdrawn(standing, reason);
      } catch (error) {
        if (
          error instanceof JudgeDisagreementVersionConflictError &&
          !retried
        ) {
          return this.withdrawingStale(runId, rubric, true);
        }
        throw error;
      }
    }

    return { label, scores, known };
  }

  private async opening(input: {
    runId: RunId;
    workspaceId: WorkspaceId;
    rubric: Rubric;
    live: Scored;
    label: HumanLabel;
  }): Promise<void> {
    const { live, rubric, label } = input;

    try {
      await this.transaction.inTransaction(() =>
        this.recorder.record(this.disagreements, {
          owner: this.ownerOf(input.workspaceId, live.location),
          load: async () => null,
          deleted: (existing) => existing.delete(),
          created: () =>
            JudgeDisagreement.open({
              id: JudgeDisagreementId.of(this.ids.generate()),
              runId: input.runId,
              workspaceId: input.workspaceId,
              location: live.location,
              verdict: {
                scoreId: live.id,
                rubricVersion: live.rubricVersion,
                claims: rubric.claims,
                claimResults: live.claimResults,
                reasons: live.reasons,
              },
              judgePasses: live.passes,
              labelFrom: label.from,
              askedOf: label.by,
              now: this.clock.now(),
            }),
          change: (existing) => existing,
        }),
      );
    } catch (error) {
      if (error instanceof JudgeDisagreementVersionConflictError) {
        return;
      }
      throw error;
    }
  }

  private async withdrawingOutdated(
    stationId: StationId,
    current: RubricVersion | null,
  ): Promise<void> {
    for (;;) {
      const outdated = await this.disagreements.outdatedAtStation(
        stationId,
        current,
        WITHDRAWN_AT_ONCE,
      );

      for (const each of outdated) {
        await this.withdrawing(each, 'claims-changed');
      }

      if (outdated.length < WITHDRAWN_AT_ONCE) {
        return;
      }
    }
  }

  private async withdrawing(
    open: JudgeDisagreement,
    reason: WithdrawalReason,
    retried = false,
  ): Promise<void> {
    try {
      await this.withdrawn(open, reason);
    } catch (error) {
      if (error instanceof JudgeDisagreementVersionConflictError && !retried) {
        return this.withdrawing(open, reason, true);
      }
      throw error;
    }
  }

  private withdrawn(
    open: JudgeDisagreement,
    reason: WithdrawalReason,
  ): Promise<unknown> {
    return this.transaction.inTransaction(() =>
      this.recorder.record(this.disagreements, {
        owner: this.ownerOf(open.workspaceId, open.location),
        load: () => this.disagreements.find(open.id),
        deleted: (existing) => existing.delete(),
        change: (existing) => existing.withdraw(this.clock.now(), reason),
      }),
    );
  }

  private async rubricAt(stationId: StationId): Promise<Rubric | null> {
    const judge = await this.judges.judgeAt(stationId);

    return judge
      ? Rubric.readable({
          claims: judge.claims,
          passThreshold: judge.passThreshold,
          version: judge.rubricVersion,
        })
      : null;
  }

  private ownerOf(workspaceId: WorkspaceId, location: RunLocation): FactOwner {
    return FactOwner.of(workspaceId, {
      teamId: location.teamId,
      taskId: location.taskId,
    });
  }
}
