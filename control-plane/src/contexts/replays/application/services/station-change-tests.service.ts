import type { PeoplePort } from '@replays/application/ports/people.port';
import type {
  LiveConfig,
  StationView,
  ValidatedCandidate,
  WorkPort,
} from '@replays/application/ports/work.port';
import { CandidateProblems } from '@replays/application/rendering/candidate-problems';
import { stationChangeRefusalReason } from '@replays/application/rendering/station-change-refusals';
import type { CheckSearchReadiness } from '@replays/application/services/check-search-readiness.service';
import type { StartSearch } from '@replays/application/services/start-search.service';
import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { MonthlyCeilingReachedError } from '@replays/domain/exceptions/monthly-ceiling-reached.error';
import { RequestLimitReachedError } from '@replays/domain/exceptions/request-limit-reached.error';
import { SearchCandidateNameTakenError } from '@replays/domain/exceptions/search-candidate-name-taken.error';
import { SearchInProgressError } from '@replays/domain/exceptions/search-in-progress.error';
import { SearchTakesNoRequestsError } from '@replays/domain/exceptions/search-takes-no-requests.error';
import { UnsearchableRequestError } from '@replays/domain/exceptions/unsearchable-request.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import { pendingPickOf } from '@replays/domain/services/pending-pick';
import {
  fitsMonth,
  monthSpentOf,
  monthStartOf,
  nextMonthStartOf,
} from '@replays/domain/services/search-schedule';
import { unsearchableChanges } from '@replays/domain/services/searchable-changes';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { CandidateName } from '@replays/domain/value-objects/candidate-name.vo';
import { Hypothesis } from '@replays/domain/value-objects/hypothesis.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { SearchRequest } from '@replays/domain/value-objects/search-request.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationPath } from '@replays/domain/value-objects/station-path.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type {
  StationChangeRefusal,
  StationChangeTestOutcome,
  StationChangeTestRequest,
  StationChangeTestScope,
  StationChangeTestsPort,
} from '@work/application/ports/station-change-tests.port';

const NAME_TAKEN = 'names another candidate of the running search already';

interface Proposal {
  readonly name: CandidateName;
  readonly hypothesis: Hypothesis;
  readonly validated: Extract<ValidatedCandidate, { ok: true }>;
  readonly address: StationPath;
  readonly requester: UserId;
}

type Checked =
  | { readonly ok: true; readonly proposal: Proposal }
  | { readonly ok: false; readonly outcome: StationChangeTestOutcome };

const invalid = (
  problems: readonly ConfigurationProblem[],
): StationChangeTestOutcome => ({
  outcome: 'invalid',
  problems: problems.map((each) => ({
    path: each.field.rendered,
    reason: each.reason,
  })),
});

const scopeOf = (search: Search): StationChangeTestScope => ({
  mode: search.budget.agentRuns ? 'search' : 'test',
  searchedTasks: search.split.searched.length,
  heldOutTasks: search.split.heldOut.length,
  iterations: search.budget.iterations,
});

export class StationChangeTests implements StationChangeTestsPort {
  constructor(
    private readonly work: WorkPort,
    private readonly people: PeoplePort,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly sets: ReplaySetRepository,
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly readiness: CheckSearchReadiness,
    private readonly starting: StartSearch,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async request(
    request: StationChangeTestRequest,
  ): Promise<StationChangeTestOutcome> {
    const { lineId, stationId } = request;
    const station = await this.work.station(lineId, stationId);

    if (
      !station?.workspaceId.equals(request.workspaceId) ||
      !station.teamId.equals(request.teamId)
    ) {
      return this.refused('station-gone');
    }

    const live = await this.work.live(lineId, stationId);

    if (!live) {
      return this.refused('not-replayable');
    }
    if (!live.search?.enabled) {
      return this.refused('search-off');
    }

    const active = await this.searches.activeAtStation(stationId);

    if (active) {
      return this.joinedOrEarlier(active, request, station);
    }

    const checked = await this.checked(request, live.block, station);

    return checked.ok
      ? this.started(request, live, station, checked.proposal)
      : checked.outcome;
  }

  private async joinedOrEarlier(
    active: Search,
    request: StationChangeTestRequest,
    station: StationView,
  ): Promise<StationChangeTestOutcome> {
    const [seed] = await this.candidates.findMany([active.seed.candidateId]);

    if (!seed) {
      return this.refused('station-gone');
    }

    const checked = await this.checked(request, seed.block, station);

    if (!checked.ok) {
      return checked.outcome;
    }

    return (
      (await this.earlierAnswer(active, checked.proposal)) ??
      this.joined(active, request, checked.proposal)
    );
  }

  private async started(
    request: StationChangeTestRequest,
    live: LiveConfig,
    station: StationView,
    proposal: Proposal,
  ): Promise<StationChangeTestOutcome> {
    const { stationId } = request;
    const schedule = await this.schedules.ofStation(stationId);
    const set = schedule && (await this.sets.find(schedule.setId));
    const policy = live.search;
    const now = this.clock.now();

    if (!policy || !schedule || !set || set.isAtGoneStation) {
      return this.refused('no-replay-set');
    }
    if (await this.resultPending(stationId)) {
      return this.refused('result-pending');
    }
    if (await this.pullRequests.openAtStation(stationId)) {
      return this.refused('pull-request-open');
    }
    if (
      !fitsMonth(
        policy,
        monthSpentOf(
          await this.searches.ofLineStartedSince(
            request.lineId,
            monthStartOf(now),
          ),
          policy.monthlyCeiling.currency,
        ),
      )
    ) {
      return this.refused('monthly-ceiling');
    }
    if (!schedule.takesRequestOn(now)) {
      return this.refused('request-limit');
    }
    if (!live.scoring.judges && !live.scoring.checksChanges) {
      return this.refused('no-scoring');
    }

    const ready = await this.readiness.check({
      set,
      schedule,
      policy,
      stationAgent: live.agent,
      iterations: policy.iterations,
      agentless: request.mode === 'test',
    });

    if (ready.kind === 'skip') {
      return this.refused(ready.reason);
    }

    const candidate = this.candidateOf(
      ready.id,
      ready.set.station,
      proposal,
      1,
    );

    try {
      const split = await this.starting.begin({
        id: ready.id,
        set: ready.set,
        agent: ready.agent,
        budget: ready.budget,
        calibrates: ready.calibrates,
        objective: ready.objective,
        trigger: 'request',
        policy,
        requested: {
          candidate,
          request: this.requestOf(candidate, proposal),
        },
      });

      return {
        outcome: 'started',
        mode: request.mode,
        searchedTasks: split.searched.length,
        heldOutTasks: split.heldOut.length,
        iterations: ready.budget.iterations,
      };
    } catch (error) {
      return this.afterFailedStart(error, request, station);
    }
  }

  private async afterFailedStart(
    error: unknown,
    request: StationChangeTestRequest,
    station: StationView,
  ): Promise<StationChangeTestOutcome> {
    if (error instanceof MonthlyCeilingReachedError) {
      return this.refused('monthly-ceiling');
    }
    if (error instanceof RequestLimitReachedError) {
      return this.refused('request-limit');
    }
    if (error instanceof UnsearchableRequestError) {
      return invalid(error.problems);
    }
    if (!(error instanceof SearchInProgressError)) {
      throw error;
    }

    const active = await this.searches.activeAtStation(request.stationId);

    return active
      ? this.joinedOrEarlier(active, request, station)
      : this.refused('search-running');
  }

  private async joined(
    seen: Search,
    request: StationChangeTestRequest,
    proposal: Proposal,
  ): Promise<StationChangeTestOutcome> {
    if (!seen.takesRequests) {
      return this.refused('search-running');
    }

    try {
      return await this.transaction.inTransaction(async () => {
        const search = await this.searches.locked(seen.id);
        const schedule = await this.schedules.locked(request.stationId);
        const at = this.clock.now();

        if (!search?.takesRequests) {
          return this.refused('search-running');
        }
        if (!schedule) {
          return this.refused('no-replay-set');
        }
        if (!schedule.takesRequestOn(at)) {
          return this.refused('request-limit');
        }

        const iteration = search.requestIteration;
        const candidate = this.candidateOf(
          search.id,
          search.station,
          proposal,
          iteration,
        );
        const requested = search.request(this.requestOf(candidate, proposal));

        await this.candidates.add(candidate);
        await this.searches.save(requested);
        await this.schedules.save(schedule.requested(at));

        return {
          outcome: 'joined',
          ...scopeOf(search),
          mode: request.mode,
          iteration,
        };
      });
    } catch (error) {
      if (error instanceof SearchCandidateNameTakenError) {
        return invalid([CandidateProblems.name(NAME_TAKEN)]);
      }
      if (error instanceof SearchTakesNoRequestsError) {
        return this.refused('search-running');
      }
      throw error;
    }
  }

  private async earlierAnswer(
    search: Search,
    proposal: Proposal,
  ): Promise<StationChangeTestOutcome | null> {
    const same = search.requested.filter(
      (each) =>
        each.requestedBy.equals(proposal.requester) &&
        each.name.value.toLowerCase() === proposal.name.value.toLowerCase(),
    );
    const candidates = await this.candidates.findMany(
      same.map((each) => each.candidateId),
    );
    const earlier = candidates.find((each) =>
      each.fingerprint.equals(proposal.validated.fingerprint),
    );

    if (!earlier) {
      return null;
    }

    return search.openingRequest?.equals(earlier.id)
      ? { outcome: 'started', ...scopeOf(search) }
      : {
          outcome: 'joined',
          ...scopeOf(search),
          iteration: earlier.search?.iteration ?? search.requestIteration,
        };
  }

  private async checked(
    request: StationChangeTestRequest,
    seed: StationBlock,
    station: StationView,
  ): Promise<Checked> {
    const teamKey = await this.people.teamKey(request.teamId);
    const validated = await this.work.validate(
      request.lineId,
      request.stationId,
      request.block,
    );
    const address =
      teamKey && StationPath.of(teamKey, station.lineKey, station.key);

    if (!validated || !address) {
      return { ok: false, outcome: this.refused('station-gone') };
    }

    const name = CandidateProblems.parsed(
      () => CandidateName.searched(request.name),
      CandidateProblems.name,
    );
    const hypothesis = CandidateProblems.parsed(
      () => Hypothesis.of(request.hypothesis),
      CandidateProblems.hypothesis,
    );
    const problems = [
      ...(name.ok ? [] : [name.problem]),
      ...(hypothesis.ok ? [] : [hypothesis.problem]),
      ...(validated.ok
        ? unsearchableChanges(seed, validated.block)
        : validated.problems),
    ];

    if (!name.ok || !hypothesis.ok || !validated.ok || problems.length > 0) {
      return { ok: false, outcome: invalid(problems) };
    }

    return {
      ok: true,
      proposal: {
        name: name.value,
        hypothesis: hypothesis.value,
        validated,
        address,
        requester: request.requester,
      },
    };
  }

  private async resultPending(stationId: string): Promise<boolean> {
    const newest = await this.searches.newestAtStation(stationId);
    const picked = newest?.pickedCandidate ?? null;
    const pickHasPullRequest =
      newest !== null &&
      picked !== null &&
      (await this.pullRequests.forCandidate(newest.id, picked)) !== null;

    return pendingPickOf(newest, pickHasPullRequest) !== null;
  }

  private candidateOf(
    searchId: SearchId,
    station: ReplayedStation,
    proposal: Proposal,
    iteration: number,
  ): Candidate {
    const { validated } = proposal;

    return Candidate.fromSearch({
      id: CandidateId.of(this.ids.generate()),
      station,
      address: proposal.address,
      name: proposal.name.value,
      block: validated.block,
      fingerprint: validated.fingerprint,
      hashes: validated.hashes,
      scoring: validated.scoring,
      changedFrom: validated.changedFrom,
      search: { searchId, iteration, hypothesis: proposal.hypothesis },
      at: this.clock.now(),
    });
  }

  private requestOf(candidate: Candidate, proposal: Proposal): SearchRequest {
    return SearchRequest.of({
      candidateId: candidate.id,
      name: proposal.name,
      requestedBy: proposal.requester,
    });
  }

  private refused(refusal: StationChangeRefusal): StationChangeTestOutcome {
    return {
      outcome: 'refused',
      code: refusal,
      reason: stationChangeRefusalReason(
        refusal,
        nextMonthStartOf(this.clock.now()),
      ),
    };
  }
}
