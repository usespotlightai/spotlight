import type {
  ConfigOriginDto,
  ConfigOriginsDto,
} from '@replays/application/dto/config-origins.dto';
import type { OutcomesPort } from '@replays/application/ports/outcomes.port';
import type { ReadConfigOriginsQuery } from '@replays/application/queries/read-config-origins.query';
import type { PossibleOrigins } from '@replays/application/services/possible-origins.service';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import {
  type ChangeAskedAbout,
  ChangesAskedAbout,
} from '@replays/domain/services/changes-asked-about';
import {
  boundsOf,
  originAskedAbout,
} from '@replays/domain/services/config-origins';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ConfigOrigin } from '@replays/domain/value-objects/config-origin.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

interface Credited {
  readonly change: ChangeAskedAbout;
  readonly origin: ConfigOrigin;
}

const viewOf = (
  { change, origin }: Credited,
  newestReplays: ReadonlyMap<string, ReplayId>,
): ConfigOriginDto => ({
  stationId: change.stationId,
  runId: change.runId.value,
  fingerprint: origin.fingerprint.value,
  changedAt: origin.changedAt.toISOString(),
  candidateId: origin.candidate.id.value,
  name: origin.candidate.name.value,
  kind: origin.candidate.kind,
  lineId: origin.lineId,
  searchId: origin.candidate.searchId?.value ?? null,
  replayId: origin.withdrawn
    ? null
    : (newestReplays.get(origin.candidate.id.value)?.value ?? null),
  createdAt: origin.candidate.createdAt.toISOString(),
  withdrawn: origin.withdrawn,
});

const proposedAmong = (credited: readonly Credited[]): CandidateId[] => [
  ...new Map(
    credited
      .filter(
        (each) =>
          each.origin.candidate.kind === 'proposed' && !each.origin.withdrawn,
      )
      .map((each) => [
        each.origin.candidate.id.value,
        each.origin.candidate.id,
      ]),
  ).values(),
];

export class ReadConfigOriginsHandler
  implements QueryHandlerPort<ReadConfigOriginsQuery, ConfigOriginsDto>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly outcomes: OutcomesPort,
    private readonly origins: PossibleOrigins,
    private readonly replays: ReplayRepository,
  ) {}

  async execute(query: ReadConfigOriginsQuery): Promise<ConfigOriginsDto> {
    try {
      const clearance = await this.access.clearance(
        query.teamId,
        query.principal,
      );
      const asked = ChangesAskedAbout.of(query.changes);

      if (asked.changes.length === 0) {
        return { origins: [] };
      }

      const possible = await this.origins.seenAt(clearance, asked.stationIds);

      if (possible.length === 0) {
        return { origins: [] };
      }

      const starts = await this.outcomes.stretchStarts(
        clearance.teamId,
        boundsOf(possible),
      );
      const credited = asked.changes.flatMap((change) => {
        const origin = originAskedAbout(change, starts, possible);
        return origin ? [{ change, origin }] : [];
      });
      const newestReplays = await this.replays.newestOfCandidates(
        proposedAmong(credited),
      );

      return {
        origins: credited.map((each) => viewOf(each, newestReplays)),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
