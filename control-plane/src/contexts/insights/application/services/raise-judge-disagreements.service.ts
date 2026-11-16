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
import {
  type HumanLabel,
  humanLabelOf,
} from '@insights/domain/services/human-label';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
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

const newestLiveOf = (
  scores: readonly Scored[],
  rubric: Rubric,
): Scored | null =>
  scores
    .filter(
      (each) =>
        each.fromJudge &&
        each.origin === LIVE &&
        each.rubricVersion === rubric.version,
    )
    .sort((one, other) => other.at.getTime() - one.at.getTime())[0] ?? null;

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
    return this.considerTask(event.location.taskId, event.workspaceId);
  }

  outcomeChanged(event: RunOutcomeChanged): Promise<void> {
    return this.considerTask(event.location.taskId, event.workspaceId);
  }

  pullRequestClosed(event: PullRequestRecordClosed): Promise<void> {
    return this.considerTask(event.taskId, event.workspaceId);
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
  ): Promise<void> {
    const rubrics = new Map<string, Promise<Rubric | null>>();
    const rubricOf = (stationId: StationId) => {
      const rubric = rubrics.get(stationId.value) ?? this.rubricAt(stationId);
      rubrics.set(stationId.value, rubric);
      return rubric;
    };

    for (const fact of await this.facts.ofTasks([taskId])) {
      if (fact.workspaceId.equals(workspaceId)) {
        await this.consider(
          fact.runId,
          workspaceId,
          fact.end.location,
          await rubricOf(fact.end.location.stationId),
        );
      }
    }
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
      known.some((each) => each.rubricVersion === rubric.version)
    ) {
      return;
    }

    const live = newestLiveOf(scores, rubric);

    if (live && label.passes !== live.passes) {
      await this.opening({ runId, workspaceId, rubric, live, label });
      await this.withdrawingStale(runId, rubric);
    }
  }

  private async withdrawingStale(runId: RunId, rubric: Rubric | null) {
    const [fact] = await this.facts.ofRuns([runId]);
    const scores = await this.facts.scoresOfRuns([runId]);
    const label = rubric
      ? humanLabelOf({
          rubricVersion: rubric.version,
          fact: fact ?? null,
          grades: scores.filter((each) => !each.fromJudge),
        })
      : null;
    const known = await this.disagreements.ofRun(runId);
    const standing = known.find((each) => !each.isWithdrawn) ?? null;
    const reason =
      standing?.noLongerHoldsBecause({
        rubricVersion: rubric?.version ?? null,
        label,
      }) ?? null;

    if (standing && reason) {
      await this.withdrawing(standing, reason);
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
                passes: live.passes,
                reasons: live.reasons,
              },
              label,
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
  ): Promise<void> {
    try {
      await this.transaction.inTransaction(() =>
        this.recorder.record(this.disagreements, {
          owner: this.ownerOf(open.workspaceId, open.location),
          load: () => this.disagreements.find(open.id),
          deleted: (existing) => existing.delete(),
          change: (existing) => existing.withdraw(this.clock.now(), reason),
        }),
      );
    } catch (error) {
      if (error instanceof JudgeDisagreementVersionConflictError) {
        return;
      }
      throw error;
    }
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
