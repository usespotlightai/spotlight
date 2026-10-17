import type { ProposeSearchCandidateCommand } from '@replays/application/commands/propose-search-candidate.command';
import type { SearchCandidateProposed } from '@replays/application/dto/replay-outcomes.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  ExaminedCandidate,
  StationView,
  WorkPort,
} from '@replays/application/ports/work.port';
import { CandidateProblems } from '@replays/application/rendering/candidate-problems';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { SearchRunNotActiveError } from '@replays/domain/exceptions/search-run-not-active.error';
import { UnknownStationError } from '@replays/domain/exceptions/unknown-station.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { unsearchableChanges } from '@replays/domain/services/searchable-changes';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { StationAddress } from '@replays/domain/value-objects/station-address.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

type Parsed<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly problem: ConfigurationProblem };

const parsed = <T>(
  made: () => T,
  refused: (reason: string) => ConfigurationProblem,
): Parsed<T> => {
  try {
    return { ok: true, value: made() };
  } catch (error) {
    if (error instanceof InvalidCandidateError) {
      return { ok: false, problem: refused(error.reason) };
    }
    throw error;
  }
};

const textOf = (raw: unknown): string => (typeof raw === 'string' ? raw : '');

const hypothesisProblem = (reason: string): ConfigurationProblem =>
  ConfigurationProblem.of({
    path: '',
    at: FieldPath.of(['hypothesis']),
    reason,
  });

interface Proposal {
  readonly name: CandidateName;
  readonly hypothesis: Hypothesis;
  readonly examined: Extract<ExaminedCandidate, { ok: true }>;
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
    private readonly replays: ReplayRepository,
    private readonly sets: ReplaySetRepository,
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
      const examined = await this.work.examine(
        lineId,
        stationId,
        command.station,
      );

      if (!station || !teamKey || !seed || !examined) {
        throw new UnknownStationError(stationId);
      }

      const name = parsed(
        () => CandidateName.searched(textOf(command.name)),
        CandidateProblems.name,
      );
      const hypothesis = parsed(
        () => Hypothesis.of(textOf(command.hypothesis)),
        hypothesisProblem,
      );
      const problems = [
        ...(name.ok ? [] : [name.problem]),
        ...(hypothesis.ok ? [] : [hypothesis.problem]),
        ...(examined.ok
          ? unsearchableChanges(seed.block, examined.block)
          : examined.problems),
      ];

      if (!name.ok || !hypothesis.ok || !examined.ok || problems.length > 0) {
        await this.refused(seen, run);

        return { outcome: 'invalid', problems };
      }

      return await this.admitted(seen, run, station, teamKey, {
        name: name.value,
        hypothesis: hypothesis.value,
        examined,
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
      ?.proposals.find((each) => each.name.value === name);

    return proposal
      ? {
          outcome: 'proposed',
          candidateId: proposal.candidateId.value,
          name: proposal.name.value,
          replayId: proposal.replay.replayId.value,
        }
      : null;
  }

  private refused(seen: Search, run: RunId): Promise<void> {
    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(seen.id);

      if (!search) {
        throw new SearchRunNotActiveError();
      }

      await this.searches.save(search.proposalRefused(run));
    });
  }

  private admitted(
    seen: Search,
    run: RunId,
    station: StationView,
    teamKey: string,
    proposal: Proposal,
  ): Promise<SearchCandidateProposed> {
    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(seen.id);
      const set = search ? await this.sets.find(search.setId) : null;

      if (!search || !set) {
        throw new SearchRunNotActiveError();
      }

      const again = this.proposedBy(search, run, proposal.name.value);

      if (again) {
        return again;
      }

      const iteration = search.iterationOf(run);
      const address = StationAddress.of(teamKey, station.lineKey, station.key);

      if (!iteration || !address) {
        throw new SearchRunNotActiveError();
      }

      const at = this.clock.now();
      const candidate = this.searched(search, proposal, address, {
        iteration: iteration.number,
        block: proposal.examined.block,
        at,
      });
      const replayId = ReplayId.of(this.ids.generate());
      const admitted = search.admitted(run, {
        candidateId: candidate.id,
        name: proposal.name,
        replayId,
      });

      await this.candidates.add(candidate);
      await this.replays.add(
        Replay.start({
          id: replayId,
          set,
          candidate,
          baseline: false,
          ceiling: search.allotment.searchReplay,
          unpricedRate: search.allotment.perRun,
          at,
          by: Attribution.spotlight(search.workspaceId),
          among: search.split.searchedRuns,
          repeats: search.budget.repeats,
          searchId: search.id,
          pairsWith: search.seed.replay.replayId,
        }),
      );
      await this.searches.save(admitted);

      return {
        outcome: 'proposed',
        candidateId: candidate.id.value,
        name: proposal.name.value,
        replayId: replayId.value,
      };
    });
  }

  private searched(
    search: Search,
    proposal: Proposal,
    address: StationAddress,
    made: { iteration: number; block: StationBlock; at: Date },
  ): Candidate {
    return Candidate.fromSearch({
      id: CandidateId.of(this.ids.generate()),
      station: search.station,
      address,
      name: proposal.name.value,
      block: made.block,
      fingerprint: proposal.examined.fingerprint,
      digests: proposal.examined.digests,
      scoring: proposal.examined.scoring,
      changedFrom: proposal.examined.changedFrom,
      search: {
        searchId: search.id,
        iteration: made.iteration,
        hypothesis: proposal.hypothesis,
      },
      at: made.at,
    });
  }
}
