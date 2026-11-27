import { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import { ClaimsSource } from '@insights/domain/aggregates/claims-source.aggregate';
import { JudgeDisagreement } from '@insights/domain/aggregates/judge-disagreement.aggregate';
import { ClaimsRevisionVersionConflictError } from '@insights/domain/exceptions/claims-revision-version-conflict.error';
import { ClaimsSourceVersionConflictError } from '@insights/domain/exceptions/claims-source-version-conflict.error';
import { JudgeDisagreementVersionConflictError } from '@insights/domain/exceptions/judge-disagreement-version-conflict.error';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import type { ClaimsSourceRepository } from '@insights/domain/repositories/claims-source.repository';
import type {
  AnsweredDisagreements,
  JudgeDisagreementRepository,
} from '@insights/domain/repositories/judge-disagreement.repository';
import type { RevisionTrigger } from '@insights/domain/services/revision-trigger';
import type { ClaimAnswerKind } from '@insights/domain/value-objects/claim-answer.vo';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { JudgeDisagreementId } from '@insights/domain/value-objects/judge-disagreement-id.vo';
import type { LabelSource } from '@insights/domain/value-objects/label-source';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import {
  CLAIMS,
  locationOf,
  RUBRIC_VERSION,
  reasonOf,
  rubricOf,
} from '@insights/judging.fake-spec';
import { WORKSPACE } from '@insights/runs.fake-spec';
import { inScope } from '@insights/scoped.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

const LABELLER = UserId.of('user_ada');

export const OPENED_AT = new Date('2026-10-01T10:00:00.000Z');

export const openDisagreement = (
  runId = 'run_1',
  change: {
    claimResults?: readonly boolean[];
    labelFrom?: LabelSource;
    taskId?: string;
    stationId?: string;
    askedOf?: UserId;
    now?: Date;
  } = {},
): JudgeDisagreement => {
  const claimResults = change.claimResults ?? [true, false, false];
  const passes = claimResults.every(Boolean);
  const labelFrom = change.labelFrom ?? (passes ? 'sent-back' : 'accepted');

  return JudgeDisagreement.open({
    id: JudgeDisagreementId.of(`disagreement_${runId}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(change.taskId ?? `task_${runId}`, change.stationId),
    verdict: {
      scoreId: ScoreId.of(`judge_${runId}`),
      rubricVersion: RUBRIC_VERSION,
      claims: CLAIMS,
      claimResults,
      reasons: claimResults.map((_, at) => reasonOf(`Claim ${at}.`, at)),
    },
    judgePasses: passes,
    labelFrom,
    askedOf: labelFrom === 'merged' ? null : (change.askedOf ?? LABELLER),
    now: change.now ?? OPENED_AT,
  });
};

export const answeredDisagreement = (
  runId: string,
  answers: readonly (readonly [number, ClaimAnswerKind, (string | null)?])[],
  at: Date = OPENED_AT,
): JudgeDisagreement =>
  answers.reduce(
    (disagreement, [claim, answer, note]) =>
      disagreement.answerClaim({
        claim,
        answer,
        note: note ?? null,
        by: LABELLER,
        now: at,
      }),
    openDisagreement(runId),
  );

export const REVISED_STATION = {
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
};

export const startedRevision = (
  change: {
    id?: string;
    rubric?: Rubric;
    trigger?: RevisionTrigger;
    now?: Date;
  } = {},
): ClaimsRevision =>
  ClaimsRevision.started({
    id: ClaimsRevisionId.of(change.id ?? 'revision_1'),
    station: REVISED_STATION,
    rubric: change.rubric ?? rubricOf(),
    trigger: change.trigger ?? 'claim-wrong',
    latest: null,
    now: change.now ?? OPENED_AT,
  });

const disagreementWithVersion = (
  disagreement: JudgeDisagreement,
  version: number,
) =>
  JudgeDisagreement.rehydrate({
    id: disagreement.id,
    runId: disagreement.runId,
    workspaceId: disagreement.workspaceId,
    location: disagreement.location,
    verdict: disagreement.verdict,
    labelFrom: disagreement.labelFrom,
    askedOf: disagreement.askedOf,
    openedAt: disagreement.openedAt,
    claimAnswers: disagreement.claimAnswers,
    notMet: disagreement.notMet,
    answeredAt: disagreement.answeredAt,
    withdrawnAt: disagreement.withdrawnAt,
    withdrawnBecause: disagreement.withdrawnBecause,
    version,
  });

export class JudgeDisagreementsInMemory implements JudgeDisagreementRepository {
  readonly stored = new Map<string, JudgeDisagreement>();
  readonly events: DomainEvent[] = [];

  add(disagreement: JudgeDisagreement): Promise<void> {
    if (
      this.stored.has(disagreement.id.value) ||
      [...this.stored.values()].some(
        (each) => !each.isWithdrawn && each.runId.equals(disagreement.runId),
      )
    ) {
      return Promise.reject(
        new JudgeDisagreementVersionConflictError(disagreement.id.value),
      );
    }
    this.events.push(...disagreement.pullEvents());
    this.stored.set(disagreement.id.value, disagreement);

    return Promise.resolve();
  }

  save(disagreement: JudgeDisagreement): Promise<void> {
    const existing = this.stored.get(disagreement.id.value);

    if (!existing || existing.version !== disagreement.version) {
      return Promise.reject(
        new JudgeDisagreementVersionConflictError(disagreement.id.value),
      );
    }
    if (disagreement.isDeleted) {
      this.stored.delete(disagreement.id.value);
      return Promise.resolve();
    }
    this.events.push(...disagreement.pullEvents());
    this.stored.set(
      disagreement.id.value,
      disagreementWithVersion(disagreement, disagreement.version + 1),
    );

    return Promise.resolve();
  }

  find(id: JudgeDisagreementId): Promise<JudgeDisagreement | null> {
    return Promise.resolve(this.stored.get(id.value) ?? null);
  }

  ofRun(runId: RunId): Promise<readonly JudgeDisagreement[]> {
    return Promise.resolve(
      [...this.stored.values()].filter((each) => each.runId.equals(runId)),
    );
  }

  standing(
    after: JudgeDisagreementId | null,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter(
          (each) =>
            !each.isWithdrawn &&
            (after === null || each.id.value > after.value),
        )
        .sort((a, b) => (a.id.value < b.id.value ? -1 : 1))
        .slice(0, max),
    );
  }

  outdatedAtStation(
    stationId: StationId,
    current: RubricVersion | null,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter(
          (each) =>
            !each.isWithdrawn &&
            each.location.stationId.equals(stationId) &&
            each.rubricVersion !== current,
        )
        .slice(0, max),
    );
  }

  answeredAt(
    criteria: AnsweredDisagreements,
  ): Promise<readonly JudgeDisagreement[]> {
    return Promise.resolve(
      [...this.stored.values()].filter(
        (each) =>
          each.location.stationId.equals(criteria.stationId) &&
          each.rubricVersion === criteria.rubricVersion &&
          !each.isWithdrawn &&
          each.answeredAt !== null &&
          (criteria.since === null ||
            each.answeredAt.getTime() > criteria.since.getTime()),
      ),
    );
  }

  ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly JudgeDisagreement[]> {
    return Promise.resolve(
      inScope(
        this.stored,
        scope,
        (each) => ({
          workspaceId: each.workspaceId,
          teamId: each.location.teamId,
          taskId: each.location.taskId,
        }),
        max,
      ),
    );
  }
}

const revisionWithVersion = (revision: ClaimsRevision, version: number) =>
  ClaimsRevision.rehydrate({
    id: revision.id,
    station: revision.station,
    rubric: revision.rubric,
    trigger: revision.trigger,
    startedAt: revision.startedAt,
    job: revision.job,
    judgeCalls: revision.judgeCalls,
    reservation: revision.reservation,
    pick: revision.pick,
    pickedAt: revision.pickedAt,
    outcome: revision.outcome,
    endedAt: revision.endedAt,
    version,
  });

export class ClaimsRevisionsInMemory implements ClaimsRevisionRepository {
  readonly stored = new Map<string, ClaimsRevision>();
  readonly events: DomainEvent[] = [];

  add(revision: ClaimsRevision): Promise<void> {
    const open = [...this.stored.values()].some(
      (each) =>
        each.endedAt === null &&
        each.station.stationId.equals(revision.station.stationId),
    );

    if (this.stored.has(revision.id.value) || open) {
      return Promise.reject(
        new ClaimsRevisionVersionConflictError(revision.id.value),
      );
    }
    this.events.push(...revision.pullEvents());
    this.stored.set(revision.id.value, revision);

    return Promise.resolve();
  }

  save(revision: ClaimsRevision): Promise<void> {
    const existing = this.stored.get(revision.id.value);

    if (!existing || existing.version !== revision.version) {
      return Promise.reject(
        new ClaimsRevisionVersionConflictError(revision.id.value),
      );
    }
    if (revision.isDeleted) {
      this.stored.delete(revision.id.value);
      return Promise.resolve();
    }
    this.events.push(...revision.pullEvents());
    this.stored.set(
      revision.id.value,
      revisionWithVersion(revision, revision.version + 1),
    );

    return Promise.resolve();
  }

  find(id: ClaimsRevisionId): Promise<ClaimsRevision | null> {
    return Promise.resolve(this.stored.get(id.value) ?? null);
  }

  latestAt(stationId: StationId): Promise<ClaimsRevision | null> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter((each) => each.station.stationId.equals(stationId))
        .sort(
          (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
        )[0] ?? null,
    );
  }

  nextDueJob(now: Date): Promise<ClaimsRevision | null> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now) === true)
        .sort(
          (one, other) => one.startedAt.getTime() - other.startedAt.getTime(),
        )[0] ?? null,
    );
  }

  pickedBefore(
    pickedAt: Date,
    max: number,
  ): Promise<readonly ClaimsRevision[]> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter(
          (each) =>
            each.endedAt === null &&
            each.pickedAt !== null &&
            each.pickedAt.getTime() < pickedAt.getTime(),
        )
        .slice(0, max),
    );
  }

  ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly ClaimsRevision[]> {
    return Promise.resolve(
      inScope(
        this.stored,
        scope,
        (each) => ({
          workspaceId: each.station.workspaceId,
          teamId: each.station.teamId,
        }),
        max,
      ),
    );
  }
}

const keyOf = (stationId: StationId, rubricVersion: RubricVersion) =>
  `${stationId.value} ${rubricVersion}`;

export class ClaimsSourcesInMemory implements ClaimsSourceRepository {
  readonly stored = new Map<string, ClaimsSource>();
  readonly events: DomainEvent[] = [];

  find(
    stationId: StationId,
    rubricVersion: RubricVersion,
  ): Promise<ClaimsSource | null> {
    return Promise.resolve(
      this.stored.get(keyOf(stationId, rubricVersion)) ?? null,
    );
  }

  ofStation(stationId: StationId): Promise<readonly ClaimsSource[]> {
    return Promise.resolve(
      [...this.stored.values()].filter((each) =>
        each.station.stationId.equals(stationId),
      ),
    );
  }

  nextDueJob(now: Date): Promise<ClaimsSource | null> {
    return Promise.resolve(
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now) === true)
        .sort(
          (one, other) => one.recordedAt.getTime() - other.recordedAt.getTime(),
        )[0] ?? null,
    );
  }

  add(source: ClaimsSource): Promise<void> {
    const key = keyOf(source.station.stationId, source.rubricVersion);

    if (this.stored.has(key)) {
      return Promise.reject(
        new ClaimsSourceVersionConflictError(
          source.station.stationId.value,
          source.rubricVersion,
        ),
      );
    }
    this.events.push(...source.pullEvents());
    this.stored.set(key, source);

    return Promise.resolve();
  }

  save(source: ClaimsSource): Promise<void> {
    const key = keyOf(source.station.stationId, source.rubricVersion);

    if (this.stored.get(key)?.version !== source.version) {
      return Promise.reject(
        new ClaimsSourceVersionConflictError(
          source.station.stationId.value,
          source.rubricVersion,
        ),
      );
    }
    if (source.isDeleted) {
      this.stored.delete(key);
      return Promise.resolve();
    }
    this.events.push(...source.pullEvents());
    this.stored.set(
      key,
      ClaimsSource.rehydrate({
        station: source.station,
        rubricVersion: source.rubricVersion,
        commit: source.commit,
        recordedAt: source.recordedAt,
        pullRequest: source.pullRequest,
        resolvedAt: source.resolvedAt,
        job: source.job,
        lookups: source.lookups,
        version: source.version + 1,
      }),
    );

    return Promise.resolve();
  }

  ofScope(scope: DeletionScope, max: number): Promise<readonly ClaimsSource[]> {
    return Promise.resolve(
      inScope(
        this.stored,
        scope,
        (each) => ({
          workspaceId: each.station.workspaceId,
          teamId: each.station.teamId,
        }),
        max,
      ),
    );
  }
}
