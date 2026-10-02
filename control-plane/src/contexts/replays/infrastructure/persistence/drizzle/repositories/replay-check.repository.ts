import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { ReplayCheckRaceError } from '@replays/domain/exceptions/replay-check-race.error';
import type {
  ReplayCheckPage,
  ReplayCheckRepository,
} from '@replays/domain/repositories/replay-check.repository';
import {
  SCORING_FIELDS,
  type ScoringField,
} from '@replays/domain/services/live-scoring';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { replayCheck } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, lt, or, type SQL } from 'drizzle-orm';

type CheckRow = typeof replayCheck.$inferSelect;

const ATTEMPT_INDEX = 'replay_check_attempt_idx';

const scoringFieldOf = (held: string): ScoringField => {
  const field = SCORING_FIELDS.find((each) => each === held);

  if (!field) {
    throw new InconsistentStateError(
      'replay check',
      `kept a part of the live station no longer known, ${held}`,
    );
  }

  return field;
};

const toCheck = (row: CheckRow): ReplayCheck =>
  ReplayCheck.rehydrate({
    id: ReplayCheckId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    stationKey: row.stationKey,
    setId: ReplaySetId.of(row.setId),
    setEntries: row.setEntries,
    attempt: row.attempt,
    candidateId: CandidateId.of(row.candidateId),
    replayId: ReplayId.of(row.replayId),
    reference: PlannedReference.of({
      commit: row.referenceCommit,
      pullRequest: row.referencePullRequest,
    }),
    liveFingerprint: StationFingerprint.of(row.liveFingerprint),
    candidateFingerprint: StationFingerprint.of(row.candidateFingerprint),
    liveDigests: StationDigests.of({
      behaviour: row.liveBehaviour,
      scoring: row.liveScoring,
    }),
    candidateDigests: StationDigests.of({
      behaviour: row.candidateBehaviour,
      scoring: row.candidateScoring,
    }),
    threshold: ReplayThreshold.of({
      mostRegressions: row.mostRegressions,
      ceiling: row.ceilingAmount,
      currency: row.ceilingCurrency,
    }),
    keptLive: row.keptLive.map(scoringFieldOf),
    baseline: row.baseline,
    createdAt: row.createdAt,
  });

@Injectable()
export class DrizzleReplayCheckRepository implements ReplayCheckRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: ReplayCheckId): Promise<ReplayCheck | null> {
    const [found] = await this.where(eq(replayCheck.id, id.value));

    return found ?? null;
  }

  matching(
    stationId: string,
    candidate: StationDigests,
    live: StationDigests,
  ): Promise<readonly ReplayCheck[]> {
    return this.where(
      and(
        eq(replayCheck.stationId, stationId),
        eq(replayCheck.candidateBehaviour, candidate.behaviour),
        eq(replayCheck.liveScoring, live.scoring),
      ) as SQL,
    );
  }

  awaitingBaseline(): Promise<readonly ReplayCheck[]> {
    return this.where(eq(replayCheck.baseline, 'awaiting'));
  }

  ofTeam(teamId: TeamId): Promise<readonly ReplayCheck[]> {
    return this.where(eq(replayCheck.teamId, teamId.value));
  }

  ofSet(setId: ReplaySetId): Promise<readonly ReplayCheck[]> {
    return this.where(eq(replayCheck.setId, setId.value));
  }

  async pageOfSet(
    setId: ReplaySetId,
    page: ReplayCheckPage,
  ): Promise<readonly ReplayCheck[]> {
    const [after] = page.before
      ? await this.context.db
          .select({ id: replayCheck.id, createdAt: replayCheck.createdAt })
          .from(replayCheck)
          .where(
            and(
              eq(replayCheck.id, page.before.value),
              eq(replayCheck.setId, setId.value),
            ),
          )
      : [];

    if (page.before && !after) {
      return [];
    }

    return (
      await this.context.db
        .select()
        .from(replayCheck)
        .where(
          and(
            eq(replayCheck.setId, setId.value),
            after
              ? or(
                  lt(replayCheck.createdAt, after.createdAt),
                  and(
                    eq(replayCheck.createdAt, after.createdAt),
                    lt(replayCheck.id, after.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(replayCheck.createdAt), desc(replayCheck.id))
        .limit(page.limit)
    ).map(toCheck);
  }

  async add(added: ReplayCheck): Promise<void> {
    await this.context.run(async () => {
      await this.context.db
        .insert(replayCheck)
        .values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          lineId: added.station.lineId,
          stationId: added.station.stationId,
          stationKey: added.stationKey,
          setId: added.setId.value,
          setEntries: added.setEntries,
          attempt: added.attempt,
          candidateId: added.candidateId.value,
          replayId: added.replayId.value,
          referenceCommit: added.reference.commit,
          referencePullRequest: added.reference.pullRequest,
          liveFingerprint: added.liveFingerprint.value,
          candidateFingerprint: added.candidateFingerprint.value,
          liveBehaviour: added.liveDigests.behaviour,
          liveScoring: added.liveDigests.scoring,
          candidateBehaviour: added.candidateDigests.behaviour,
          candidateScoring: added.candidateDigests.scoring,
          mostRegressions: added.threshold.mostRegressions,
          ceilingAmount: added.threshold.ceiling.amount,
          ceilingCurrency: added.threshold.ceiling.currency,
          keptLive: [...added.keptLive],
          baseline: added.baseline,
          createdAt: added.createdAt,
        })
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, ATTEMPT_INDEX)) {
            throw new ReplayCheckRaceError(added.stationKey);
          }
          throw error;
        });
      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: ReplayCheck): Promise<void> {
    await this.context.run(async () => {
      if (saved.isAbandoned) {
        await this.context.db
          .delete(replayCheck)
          .where(eq(replayCheck.id, saved.id.value));
      } else {
        await this.context.db
          .update(replayCheck)
          .set({ baseline: saved.baseline })
          .where(eq(replayCheck.id, saved.id.value));
      }
      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async where(where: SQL): Promise<readonly ReplayCheck[]> {
    return (
      await this.context.db
        .select()
        .from(replayCheck)
        .where(where)
        .orderBy(asc(replayCheck.createdAt), asc(replayCheck.id))
    ).map(toCheck);
  }
}
