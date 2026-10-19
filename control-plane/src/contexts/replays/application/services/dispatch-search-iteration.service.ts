import type {
  SearchRunQueued,
  StationView,
  WorkPort,
} from '@replays/application/ports/work.port';
import { ReflectionBriefing } from '@replays/application/rendering/reflection-briefing';
import { SearchBriefing } from '@replays/application/rendering/search-briefing';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { failingSearchedTasksOf } from '@replays/domain/services/reflected-tasks';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { ReflectedTask } from '@replays/domain/value-objects/reflected-task.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchIteration } from '@replays/domain/value-objects/search-iteration.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const UNBRIEFED: SearchRunQueued = {
  queued: false,
  reason:
    'the config it started from is gone, or it had no failing task to look into',
};

interface ReflectionFocus {
  readonly incumbent: CandidateId;
  readonly tasks: readonly ReflectedTask[];
}

interface IterationContext {
  readonly station: StationView;
  readonly seed: Candidate;
}

export class DispatchSearchIteration {
  constructor(
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
    private readonly healths: SetHealths,
    private readonly work: WorkPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async requested(searchId: SearchId): Promise<void> {
    const search = await this.searches.find(searchId);
    const iteration = search?.wantedIteration ?? null;

    if (!search || !iteration) {
      return;
    }

    const station = await this.stationOf(search);
    const briefing = station
      ? await this.briefingFor(search, iteration, station)
      : null;
    const queued = briefing
      ? await this.work.dispatchSearch({
          run: iteration.runId,
          searchId: search.id,
          iteration: iteration.number,
          lineId: search.station.lineId,
          stationId: search.station.stationId,
          agent: search.agent,
          briefing,
        })
      : UNBRIEFED;
    const stationLeft =
      !queued.queued && (!station || !(await this.stationOf(search)));
    const stillWanted = await this.transaction.inTransaction(async () => {
      const fresh = await this.searches.locked(search.id);

      if (!fresh) {
        return false;
      }

      const changed = queued.queued
        ? fresh.queueRun(iteration.runId)
        : stationLeft
          ? fresh.stationLeft(this.clock.now())
          : fresh.recordRunEnd(
              iteration.runId,
              { failed: true, started: false },
              this.clock.now(),
              () => RunId.of(this.ids.generate()),
            );

      if (changed !== fresh) {
        await this.searches.save(changed);
      }

      return changed.activeRun?.equals(iteration.runId) ?? false;
    });

    if (queued.queued && !stillWanted) {
      await this.work.cancelSearchRun(iteration.runId);
    }
  }

  private stationOf(search: Search): Promise<StationView | null> {
    return this.work.station(search.station.lineId, search.station.stationId);
  }

  private async briefingFor(
    search: Search,
    iteration: SearchIteration,
    station: StationView,
  ): Promise<string | null> {
    const [seed] = await this.candidates.findMany([search.seed.candidateId]);

    if (!seed) {
      return null;
    }

    return iteration.reflects
      ? this.reflectionBriefing(search, iteration, { station, seed })
      : this.proposalBriefing(search, iteration, { station, seed });
  }

  private proposalBriefing(
    search: Search,
    iteration: SearchIteration,
    { station, seed }: IterationContext,
  ): string {
    const ceiling = search.budget.ceiling;
    const left = ceiling.amount - search.spent.amount;
    const reflection = [...search.iterations]
      .reverse()
      .find((each) => each.reflects);

    return SearchBriefing.of({
      stationKey: station.key,
      stationName: station.name,
      lineKey: station.lineKey,
      seed: seed.block,
      iteration: iteration.number,
      iterations: search.budget.iterations,
      perIteration: search.budget.perIteration,
      left: Money.of(Math.max(0, left), ceiling.currency),
      ceiling,
      searchedTasks: search.split.searchedTasks,
      heldOutTasks: search.split.heldOutTasks,
      objective: search.objective,
      configCauses: (reflection?.causes ?? []).filter(
        (each) => each.configCanFix,
      ),
    });
  }

  private async reflectionBriefing(
    search: Search,
    iteration: SearchIteration,
    { station }: IterationContext,
  ): Promise<string | null> {
    const focus = await this.reflectingOn(search, iteration);

    if (!focus) {
      return null;
    }

    const seed = search.seed.candidateId.equals(focus.incumbent);

    return ReflectionBriefing.of({
      stationKey: station.key,
      stationName: station.name,
      lineKey: station.lineKey,
      iteration: iteration.number,
      iterations: search.budget.iterations,
      incumbentName: seed
        ? SEED_NAME
        : (search.proposals.find((each) =>
            each.candidateId.equals(focus.incumbent),
          )?.name.value ?? SEED_NAME),
      seed,
      tasks: focus.tasks,
    });
  }

  private async reflectingOn(
    seen: Search,
    reflection: SearchIteration,
  ): Promise<ReflectionFocus | null> {
    const { minGain } = await this.healths.standardAt(seen.station);
    const replays = await this.replays.ofSearch(seen.id);

    return this.transaction.inTransaction(async () => {
      const search = await this.searches.locked(seen.id);
      const current = search?.iterationOf(reflection.runId);

      if (!search || !current?.ownsActiveRun) {
        return null;
      }
      if (current.incumbent) {
        return { incumbent: current.incumbent, tasks: current.reflectedOn };
      }

      const failing = failingSearchedTasksOf(search, replays, minGain);
      const reflecting = search.reflectingOn(
        current.runId,
        failing.candidateId,
        failing.tasks,
        this.clock.now(),
        () => RunId.of(this.ids.generate()),
      );
      const after = reflecting.iterationOf(current.runId);

      await this.searches.save(reflecting);

      return after?.ownsActiveRun && after.incumbent
        ? { incumbent: after.incumbent, tasks: after.reflectedOn }
        : null;
    });
  }
}
