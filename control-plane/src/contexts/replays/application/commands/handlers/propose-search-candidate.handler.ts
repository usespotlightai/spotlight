import type { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import type { SearchCandidateProposed } from '@replays/application/dto/replay-outcomes.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  StationView,
  ValidatedCandidate,
  WorkPort,
} from '@replays/application/ports/work.port';
import type { LiveCandidates } from '@replays/application/services/live-candidates.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { SearchRunNotActiveError } from '@replays/domain/exceptions/search-run-not-active.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { searchedProposalOf } from '@replays/domain/services/searched-proposal';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw : '');

interface Proposal {
  readonly name: CandidateName;
  readonly hypothesis: Hypothesis;
  readonly validated: Extract<ValidatedCandidate, { ok: true }>;
}

export class ProposeSearchCandidateHandler
  implements
    CommandHandlerPort<ProposeSearchCandidateCommand, SearchCandidateProposed>
{
  constructor(
    private readonly people: PeoplePort,
    private readonly work: WorkPort,
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly snapshots: LiveCandidates,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: ProposeSearchCandidateCommand,
  ): Promise<SearchCandidateProposed> {
    try {
      const run = RunId.of(command.runId);
      const leased = await this.work.leasedSearchRun(run, command.runnerId);
      const seen = leased ? await this.searches.find(leased.searchId) : null;

      if (!seen) {
        throw new SearchRunNotActiveError();
      }

      const already = this.proposedBy(seen, run, textOf(command.name));

      if (already) {
        return already;
      }

      const { lineId, stationId } = seen.station;
      const station = await this.work.station(lineId, stationId);
      const teamKey = await this.people.teamKey(seen.teamId);
      const [seed] = await this.candidates.findMany([seen.seed.candidateId]);
      const validated = await this.work.validate(
        lineId,
        stationId,
        command.station,
      );

      if (!station || !teamKey || !seed || !validated) {
        throw new UnknownStationError(stationId.value);
      }

      const proposal = searchedProposalOf({
        name: textOf(command.name),
        hypothesis: textOf(command.hypothesis),
        seed: seed.block,
        proposed: validated,
      });

      if (!proposal.ok || !validated.ok) {
        await this.rejected(seen, run);

        return {
          outcome: 'invalid',
          problems: proposal.ok ? [] : proposal.problems,
        };
      }

      return await this.acceptProposal(seen, run, station, teamKey, {
        name: proposal.name,
        hypothesis: proposal.hypothesis,
        validated,
      });
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private proposedBy(
    search: Search,
    run: RunId,
    name: string,
  ): SearchCandidateProposed | null {
    const proposal = search
      .iterationOf(run)
      ?.proposals.find((each) => each.name.is(name));

    return proposal
      ? {
          outcome: 'proposed',
          candidateId: proposal.candidateId.value,
          name: proposal.name.value,
          replayId: proposal.replay.replayId.value,
        }
      : null;
  }

  private rejected(seen: Search, run: RunId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(seen.id);

      if (!search) {
        throw new SearchRunNotActiveError();
      }

      await this.searches.save(search.proposalRejected(run));
    });
  }

  private async acceptProposal(
    seen: Search,
    run: RunId,
    station: StationView,
    teamKey: string,
    proposal: Proposal,
  ): Promise<SearchCandidateProposed> {
    const iteration = seen.iterationOf(run);
    const address = StationPath.of(teamKey, station.lineKey, station.key);

    if (!iteration || !address) {
      throw new SearchRunNotActiveError();
    }

    const candidate = this.searched(seen, proposal, address, {
      iteration: iteration.number,
      block: proposal.validated.block,
      at: this.clock.now(),
    });
    let accepted = false;

    await this.snapshots.kept(candidate);

    try {
      const proposed = await this.transaction.inTransaction(async () => {
        const search = await this.searches.locked(seen.id);

        if (!search) {
          throw new SearchRunNotActiveError();
        }

        const again = this.proposedBy(search, run, proposal.name.value);

        if (again) {
          return again;
        }
        if (search.iterationOf(run)?.number !== iteration.number) {
          throw new SearchRunNotActiveError();
        }

        const replayId = ReplayId.of(this.ids.generate());

        await this.searches.save(
          search.acceptProposal(run, {
            candidateId: candidate.id,
            name: proposal.name,
            replayId,
          }),
        );
        accepted = true;

        return {
          outcome: 'proposed' as const,
          candidateId: candidate.id.value,
          name: proposal.name.value,
          replayId: replayId.value,
        };
      });

      if (!accepted) {
        await this.snapshots.release(candidate);
      }

      return proposed;
    } catch (error) {
      await this.snapshots.release(candidate);
      throw error;
    }
  }

  private searched(
    search: Search,
    proposal: Proposal,
    address: StationPath,
    made: { iteration: number; block: StationBlock; at: Date },
  ): Candidate {
    return Candidate.fromSearch({
      id: CandidateId.of(this.ids.generate()),
      station: search.station,
      address,
      name: proposal.name.value,
      block: made.block,
      fingerprint: proposal.validated.fingerprint,
      hashes: proposal.validated.hashes,
      scoring: proposal.validated.scoring,
      changedFrom: proposal.validated.changedFrom,
      search: {
        searchId: search.id,
        iteration: made.iteration,
        hypothesis: proposal.hypothesis,
      },
      at: made.at,
    });
  }
}
