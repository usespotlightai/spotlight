import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { CandidateMovedOnError } from '@replays/domain/exceptions/candidate-moved-on.error';
import { CandidateNameTakenError } from '@replays/domain/exceptions/candidate-name-taken.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { replayCandidate } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, type SQL } from 'drizzle-orm';

type CandidateRow = typeof replayCandidate.$inferSelect;

const ADDRESS_INDEX = 'replay_candidate_address_idx';

const addressOf = (row: CandidateRow): StationAddress => {
  const address = StationAddress.of(row.teamKey, row.lineKey, row.stationKey);

  if (!address) {
    throw new InconsistentStateError(
      'replay candidate',
      `is held at a station address that is no address: ${row.teamKey}/${row.lineKey}/${row.stationKey}`,
    );
  }

  return address;
};

const toCandidate = (row: CandidateRow): Candidate =>
  Candidate.rehydrate({
    id: CandidateId.of(row.id),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    address: addressOf(row),
    name: CandidateName.of(row.name),
    kind: row.kind,
    block: StationBlock.of(row.station),
    fingerprint: StationFingerprint.of(row.fingerprint),
    scoring: CandidateScoring.of({
      checksChanges: row.checksChanges,
      rubric: row.rubric,
      rubricVersion: row.rubricVersion,
    }),
    changedFrom: StationChanges.of(
      StationFingerprint.of(row.changedFrom),
      row.changes,
    ),
    createdAt: row.createdAt,
    version: row.version,
  });

@Injectable()
export class DrizzleCandidateRepository implements CandidateRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: CandidateId): Promise<Candidate | null> {
    const [found] = await this.where(eq(replayCandidate.id, id.value));

    return found ?? null;
  }

  async locked(id: CandidateId): Promise<Candidate | null> {
    const [found] = await this.where(
      eq(replayCandidate.id, id.value),
      'update',
    );

    return found ?? null;
  }

  async lockedForUse(id: CandidateId): Promise<Candidate | null> {
    const [found] = await this.where(eq(replayCandidate.id, id.value), 'share');

    return found ?? null;
  }

  findMany(ids: readonly CandidateId[]): Promise<readonly Candidate[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }

    return this.where(
      inArray(replayCandidate.id, [...new Set(ids.map((each) => each.value))]),
    );
  }

  ofTeam(teamId: TeamId): Promise<readonly Candidate[]> {
    return this.where(eq(replayCandidate.teamId, teamId.value));
  }

  ofTeams(teamIds: readonly TeamId[]): Promise<readonly Candidate[]> {
    if (teamIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.where(
      inArray(
        replayCandidate.teamId,
        teamIds.map((each) => each.value),
      ),
    );
  }

  async proposedAt(
    teamId: TeamId,
    address: CandidateAddress,
  ): Promise<Candidate | null> {
    const [found] = await this.where(
      and(
        eq(replayCandidate.teamId, teamId.value),
        eq(replayCandidate.lineKey, address.station.lineKey),
        eq(replayCandidate.stationKey, address.station.stationKey),
        eq(replayCandidate.name, address.name.value),
        eq(replayCandidate.kind, 'proposed'),
      ) as SQL,
    );

    return found ?? null;
  }

  async save(saved: Candidate): Promise<void> {
    if (!saved.isAbandoned) {
      return;
    }

    await this.context.run(async () => {
      const written = await this.context.db
        .delete(replayCandidate)
        .where(
          and(
            eq(replayCandidate.id, saved.id.value),
            eq(replayCandidate.version, saved.version),
          ),
        )
        .returning({ id: replayCandidate.id });

      if (written.length === 0) {
        throw new CandidateMovedOnError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async add(added: Candidate): Promise<void> {
    await this.context.run(async () => {
      const written = await this.context.db
        .insert(replayCandidate)
        .values({
          id: added.id.value,
          workspaceId: added.workspaceId.value,
          teamId: added.teamId.value,
          lineId: added.station.lineId,
          stationId: added.station.stationId,
          teamKey: added.stationAddress.teamKey,
          lineKey: added.stationAddress.lineKey,
          stationKey: added.stationAddress.stationKey,
          name: added.name.value,
          kind: added.kind,
          station: { ...added.block.value },
          fingerprint: added.fingerprint.value,
          checksChanges: added.scoring.checksChanges,
          rubric: added.scoring.rubric,
          rubricVersion: added.scoring.rubricVersion,
          changedFrom: added.changedFrom.from.value,
          changes: added.changedFrom.changes.map((each) => ({ ...each })),
          createdAt: added.createdAt,
          version: added.version,
        })
        .onConflictDoNothing({ target: replayCandidate.id })
        .returning({ id: replayCandidate.id })
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, ADDRESS_INDEX)) {
            throw new CandidateNameTakenError(added.address.toString());
          }
          throw error;
        });

      if (written.length === 0) {
        throw new CandidateMovedOnError(added.id.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  private async where(
    condition: SQL,
    lock: 'update' | 'share' | null = null,
  ): Promise<readonly Candidate[]> {
    const query = this.context.db
      .select()
      .from(replayCandidate)
      .where(condition)
      .orderBy(asc(replayCandidate.createdAt), asc(replayCandidate.id));
    const rows = lock ? await query.for(lock) : await query;

    return rows.map(toCandidate);
  }
}
