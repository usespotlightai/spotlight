import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  UNIQUE_VIOLATION,
  violates,
} from '@platform/persistence/drizzle/violations';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { CandidateMovedOnError } from '@replays/domain/exceptions/candidate-moved-on.error';
import { CandidateNameTakenError } from '@replays/domain/exceptions/candidate-name-taken.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { CandidateAddress } from '@replays/domain/value-objects/candidate-address.vo';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import {
  ORIGIN_KINDS,
  type OriginKind,
} from '@replays/domain/value-objects/candidate-kind';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PossibleOrigin } from '@replays/domain/value-objects/config-origin.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { JudgeCriteria } from '@replays/domain/value-objects/judge-criteria.vo';
import { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import {
  replayCandidate,
  withdrawnOriginCandidate,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, type SQL, sql } from 'drizzle-orm';

type CandidateRow = typeof replayCandidate.$inferSelect;

interface OriginRow {
  readonly id: string;
  readonly workspaceId: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
  readonly fingerprint: string;
  readonly name: string;
  readonly kind: string;
  readonly searchId: string | null;
  readonly createdAt: Date;
  readonly withdrawn: boolean;
}

const originKindOf = (row: OriginRow): OriginKind => {
  const kind = ORIGIN_KINDS.find((each) => each === row.kind);

  if (!kind || (kind === 'searched') !== (row.searchId !== null)) {
    throw new InconsistentStateError(
      'origin candidate',
      `is searched or proposed, naming the search that found it when, and only when, a search did: ${row.id}`,
    );
  }

  return kind;
};

const possibleOriginOf = (row: OriginRow): PossibleOrigin => ({
  workspaceId: WorkspaceId.of(row.workspaceId),
  teamId: TeamId.of(row.teamId),
  lineId: row.lineId,
  stationId: row.stationId,
  fingerprint: StationFingerprint.of(row.fingerprint),
  candidate: {
    id: CandidateId.of(row.id),
    name: CandidateName.of(row.name),
    kind: originKindOf(row),
    searchId: row.searchId === null ? null : SearchId.of(row.searchId),
    createdAt: row.createdAt,
  },
  withdrawn: row.withdrawn,
});

const ADDRESS_INDEX = 'replay_candidate_address_idx';

const SEARCH_NAME_INDEX = 'replay_candidate_search_name_idx';

const searchOf = (row: CandidateRow) =>
  row.searchId !== null && row.iteration !== null && row.hypothesis !== null
    ? {
        searchId: SearchId.of(row.searchId),
        iteration: row.iteration,
        hypothesis: Hypothesis.of(row.hypothesis),
      }
    : null;

const referenceOf = (row: CandidateRow): PlannedReference | null =>
  row.kind === 'planned'
    ? PlannedReference.of({
        commit: row.referenceCommit,
        pullRequest: row.referencePullRequest,
      })
    : null;

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
    digests: StationDigests.of({
      behaviour: row.behaviourDigest,
      scoring: row.scoringDigest,
    }),
    line: row.lineFields ? PlannedLine.of(row.lineFields) : null,
    scoring: CandidateScoring.of({
      checksChanges: row.checksChanges,
      judge:
        row.claims === null || row.passShare === null
          ? null
          : JudgeCriteria.of({
              rubric: row.rubric,
              claims: row.claims,
              passShare: row.passShare,
            }),
      rubricVersion: row.rubricVersion,
    }),
    changedFrom: StationChanges.of(
      StationFingerprint.of(row.changedFrom),
      row.changes,
    ),
    search: searchOf(row),
    reference: referenceOf(row),
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

  async possibleOriginsAt(
    teamId: TeamId,
    stationIds: readonly string[],
  ): Promise<readonly PossibleOrigin[]> {
    if (stationIds.length === 0) {
      return [];
    }

    const stations = [...new Set(stationIds)];
    const rows = await this.context.db
      .select({
        id: replayCandidate.id,
        workspaceId: replayCandidate.workspaceId,
        teamId: replayCandidate.teamId,
        lineId: replayCandidate.lineId,
        stationId: replayCandidate.stationId,
        fingerprint: replayCandidate.fingerprint,
        name: replayCandidate.name,
        kind: sql<string>`${replayCandidate.kind}::text`,
        searchId: replayCandidate.searchId,
        createdAt: replayCandidate.createdAt,
        withdrawn: sql<boolean>`false`,
      })
      .from(replayCandidate)
      .where(
        and(
          eq(replayCandidate.teamId, teamId.value),
          inArray(replayCandidate.stationId, stations),
          inArray(replayCandidate.kind, [...ORIGIN_KINDS]),
        ),
      )
      .unionAll(
        this.context.db
          .select({
            id: withdrawnOriginCandidate.id,
            workspaceId: withdrawnOriginCandidate.workspaceId,
            teamId: withdrawnOriginCandidate.teamId,
            lineId: withdrawnOriginCandidate.lineId,
            stationId: withdrawnOriginCandidate.stationId,
            fingerprint: withdrawnOriginCandidate.fingerprint,
            name: withdrawnOriginCandidate.name,
            kind: sql<string>`'proposed'`,
            searchId: sql<string | null>`null`,
            createdAt: withdrawnOriginCandidate.createdAt,
            withdrawn: sql<boolean>`true`,
          })
          .from(withdrawnOriginCandidate)
          .where(
            and(
              eq(withdrawnOriginCandidate.teamId, teamId.value),
              inArray(withdrawnOriginCandidate.stationId, stations),
            ),
          ),
      );

    return rows.map(possibleOriginOf);
  }

  async removeWithdrawn(id: CandidateId): Promise<void> {
    await this.context.db
      .delete(withdrawnOriginCandidate)
      .where(eq(withdrawnOriginCandidate.id, id.value));
  }

  async removeWithdrawnOfTeam(teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(withdrawnOriginCandidate)
      .where(eq(withdrawnOriginCandidate.teamId, teamId.value));
  }

  async removeWithdrawnAtStations(
    stationIds: readonly string[],
  ): Promise<void> {
    if (stationIds.length === 0) {
      return;
    }

    await this.context.db
      .delete(withdrawnOriginCandidate)
      .where(
        inArray(withdrawnOriginCandidate.stationId, [...new Set(stationIds)]),
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
    if (!saved.isGone) {
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

      const origin = saved.withdrawnOrigin;

      if (origin) {
        await this.context.db
          .insert(withdrawnOriginCandidate)
          .values({
            id: origin.candidate.id.value,
            workspaceId: origin.workspaceId.value,
            teamId: origin.teamId.value,
            lineId: origin.lineId,
            stationId: origin.stationId,
            fingerprint: origin.fingerprint.value,
            name: origin.candidate.name.value,
            createdAt: origin.candidate.createdAt,
          })
          .onConflictDoNothing({ target: withdrawnOriginCandidate.id });
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
          behaviourDigest: added.digests.behaviour,
          scoringDigest: added.digests.scoring,
          lineFields: added.line?.value ?? null,
          checksChanges: added.scoring.checksChanges,
          rubric: added.scoring.judge?.rubric ?? null,
          claims: added.scoring.judge ? [...added.scoring.judge.claims] : null,
          passShare: added.scoring.judge?.passShare ?? null,
          rubricVersion: added.scoring.rubricVersion,
          changedFrom: added.changedFrom.from.value,
          changes: added.changedFrom.changes.map((each) => ({ ...each })),
          searchId: added.search?.searchId.value ?? null,
          iteration: added.search?.iteration ?? null,
          hypothesis: added.search?.hypothesis.value ?? null,
          referenceCommit: added.reference?.commit ?? null,
          referencePullRequest: added.reference?.pullRequest ?? null,
          createdAt: added.createdAt,
          version: added.version,
        })
        .onConflictDoNothing({ target: replayCandidate.id })
        .returning({ id: replayCandidate.id })
        .catch((error: unknown) => {
          if (violates(error, UNIQUE_VIOLATION, ADDRESS_INDEX)) {
            throw new CandidateNameTakenError(added.address.toString());
          }
          if (violates(error, UNIQUE_VIOLATION, SEARCH_NAME_INDEX)) {
            throw new SearchCandidateNameTakenError(added.name.value);
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
