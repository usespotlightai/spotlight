import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import {
  PEOPLE,
  type PeoplePort,
} from '@replays/application/ports/people.port';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { LiveSnapshots } from '@replays/application/services/live-snapshots.service';
import { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  currentBaselineFor,
  needsBaseline,
} from '@replays/domain/services/baseline';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import { DrizzleCandidateRepository } from '@replays/infrastructure/persistence/drizzle/repositories/candidate.repository';
import { DrizzleReplayRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay.repository';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';

let planned = 0;

export const plannedCandidate = async (
  app: INestApplication,
  lineId: string,
  stationKey: string,
  block: Record<string, unknown>,
): Promise<string> => {
  const work = app.get<WorkPort>(WORK);
  const station = await work.keyed(lineId, stationKey);
  const teamKey =
    station && (await app.get<PeoplePort>(PEOPLE).teamKey(station.teamId));
  const validated =
    station && (await work.validate(lineId, station.stationId, block));
  const address =
    station && teamKey
      ? StationPath.of(teamKey, station.lineKey, station.key)
      : null;

  if (!station || !address || !validated?.ok) {
    throw new Error(`Station ${stationKey} cannot replay the planned block.`);
  }

  planned += 1;

  const candidate = Candidate.plan({
    id: CandidateId.of(randomUUID()),
    station,
    address,
    block: StationBlock.of(block),
    fingerprint: validated.fingerprint,
    hashes: validated.hashes,
    scoring: validated.scoring,
    changedFrom: validated.changedFrom,
    reference: PlannedReference.of({ pullRequest: planned }),
    line: null,
    at: new Date(),
  });

  await app.get(DrizzleCandidateRepository).add(candidate);

  return candidate.id.value;
};

export interface StartedReplay {
  readonly id: string;
  readonly baselineId: string | null;
}

export const startedReplay = async (
  app: INestApplication,
  setId: string,
  terms: {
    readonly candidate: string;
    readonly amount: number;
    readonly repeats?: number;
  },
): Promise<StartedReplay> => {
  const sets = app.get(DrizzleReplaySetRepository);
  const replays = app.get(DrizzleReplayRepository);
  const snapshots = app.get(LiveSnapshots);
  const repeats = terms.repeats ?? 1;
  const ceiling = Money.ceiling(terms.amount, 'USD');

  await app.get(RefreshKeptSets).refreshBefore(ReplaySetId.of(setId));

  const seen = await sets.find(ReplaySetId.of(setId));

  if (!seen) {
    throw new Error(`Replay set ${setId} not found.`);
  }

  const requested =
    terms.candidate === 'live'
      ? null
      : await app
          .get(DrizzleCandidateRepository)
          .find(CandidateId.of(terms.candidate));
  const scoring = await snapshots.scoringOf(seen);
  const wantedBefore = needsBaseline(
    seen,
    await replays.ofSet(seen.id),
    scoring,
    repeats,
  );
  const live = !requested || wantedBefore ? await snapshots.taken(seen) : null;
  const id = ReplayId.of(randomUUID());
  const baselineId = ReplayId.of(randomUUID());

  const started = await app
    .get<TransactionPort>(TRANSACTION)
    .inTransaction(async () => {
      const set = await sets.locked(seen.id);

      if (!set) {
        throw new Error(`Replay set ${setId} not found.`);
      }

      const ofSet = await replays.ofSet(set.id);
      const needed = needsBaseline(set, ofSet, scoring, repeats);
      const asBaseline = needed && !requested;
      const wanting =
        requested && needed && live
          ? { id: baselineId, candidate: live, repeats, ceiling }
          : null;

      await replays.add(
        Replay.start({
          id,
          set,
          candidate: requested ?? (live as Candidate),
          baseline: asBaseline,
          ceiling,
          repeats,
          pairwiseReferenceId: asBaseline
            ? null
            : (wanting?.id ??
              currentBaselineFor(set, ofSet, scoring, repeats)?.id ??
              null),
          at: new Date(),
          by: ChangeActor.spotlight(set.workspaceId),
          wanting,
        }),
      );

      return {
        id: id.value,
        baselineId: asBaseline ? id.value : wanting ? baselineId.value : null,
      };
    });

  if (requested && started.baselineId === null) {
    await snapshots.release(live);
  }

  return started;
};

export const replayOf = async (
  app: INestApplication,
  id: string,
): Promise<Replay> => {
  const found = await app.get(DrizzleReplayRepository).find(ReplayId.of(id));

  if (!found) {
    throw new Error(`Replay ${id} not found.`);
  }

  return found;
};
