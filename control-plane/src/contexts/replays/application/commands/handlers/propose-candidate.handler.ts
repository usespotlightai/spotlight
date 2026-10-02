import type { ProposeCandidateCommand } from '@replays/application/commands/propose-candidate.command';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import { CandidateProblems } from '@replays/application/rendering/candidate-problems';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { CandidateNameTakenError } from '@replays/domain/exceptions/candidate-name-taken.error';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import {
  forbiddenTo,
  type ResourceCreated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { IdempotentCreatesPort } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { createdOnce } from '@shared-kernel/application/services/created-once';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { IdempotencyKey } from '@shared-kernel/domain/value-objects/idempotency-key.vo';

type Named =
  | { readonly ok: true; readonly name: CandidateName }
  | { readonly ok: false; readonly reason: string };

const nameOf = (written: unknown): Named => {
  try {
    return {
      ok: true,
      name: CandidateName.proposed(typeof written === 'string' ? written : ''),
    };
  } catch (error) {
    if (error instanceof InvalidCandidateError) {
      return { ok: false, reason: error.reason };
    }
    throw error;
  }
};

class ProposalRefusedError extends Error {
  constructor(readonly problems: readonly ConfigurationProblem[]) {
    super('The proposal is not valid');
    this.name = 'ProposalRefusedError';
  }
}

const fieldsOf = (held: unknown): Readonly<Record<string, unknown>> =>
  typeof held === 'object' && held !== null && !Array.isArray(held)
    ? (held as Record<string, unknown>)
    : {};

export class ProposeCandidateHandler
  implements CommandHandlerPort<ProposeCandidateCommand, ResourceCreated | null>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly candidates: CandidateRepository,
    private readonly creates: IdempotentCreatesPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: ProposeCandidateCommand,
  ): Promise<ResourceCreated | null> {
    try {
      const station = await this.work.keyed(command.lineId, command.stationKey);
      const standing = station
        ? await this.people.standingOn(
            station.teamId.value,
            command.actor.principal,
          )
        : null;
      const teamKey = station
        ? await this.people.teamKey(station.teamId)
        : null;
      const address =
        station && teamKey
          ? StationAddress.of(teamKey, station.lineKey, station.key)
          : null;

      if (!station || !standing || !address) {
        return null;
      }

      if (!standing.mayPlan) {
        return forbiddenTo('plan');
      }

      const { name: written, station: block } = fieldsOf(command.definition);
      const named = nameOf(written);

      try {
        return await this.transaction.run(() =>
          createdOnce(
            this.creates,
            {
              by: command.actor.principal.toString(),
              key: IdempotencyKey.of(command.idempotencyKey),
              request: {
                replayCandidate: 'propose',
                lineId: command.lineId,
                stationKey: command.stationKey,
                definition: command.definition,
              },
            },
            async () => {
              const examined = await this.work.examine(
                station.lineId,
                station.stationId,
                block,
              );

              if (!examined) {
                throw new UnknownStationError(command.stationKey);
              }

              if (!named.ok || !examined.ok) {
                throw new ProposalRefusedError([
                  ...(named.ok ? [] : [CandidateProblems.name(named.reason)]),
                  ...(examined.ok ? [] : examined.problems),
                ]);
              }

              const proposed = Candidate.proposed({
                id: CandidateId.of(this.ids.generate()),
                station,
                address,
                name: named.name,
                block: StationBlock.of(block),
                fingerprint: examined.fingerprint,
                digests: examined.digests,
                scoring: examined.scoring,
                changedFrom: examined.changedFrom,
                at: this.clock.now(),
                by: Attribution.of(command.actor, station.workspaceId),
              });

              await this.candidates.add(proposed);

              return proposed.id.value;
            },
          ),
        );
      } catch (error) {
        if (error instanceof CandidateNameTakenError) {
          return { outcome: 'taken', address: error.address };
        }
        if (error instanceof ProposalRefusedError) {
          return { outcome: 'invalid', problems: error.problems };
        }

        throw error;
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
