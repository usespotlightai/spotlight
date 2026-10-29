import type { HashPort } from '@replays/application/ports/hash.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { RefreshKeptSets } from '@replays/application/services/refresh-kept-sets.service';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { NoFreshHeldOutError } from '@replays/domain/exceptions/no-fresh-held-out.error';
import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import { objectiveFor } from '@replays/domain/services/search-objective';
import {
  type SetSkipReason,
  setVerdict,
} from '@replays/domain/services/search-schedule';
import { searchWarningsOf } from '@replays/domain/services/search-warnings';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import { SearchBudget } from '@replays/domain/value-objects/search-budget.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';

type SplitReading = 'too-small' | 'no-fresh' | HeldOutSplit;

export type SearchReadiness =
  | {
      readonly kind: 'skip';
      readonly reason: SetSkipReason;
      readonly checkAfter: Date;
    }
  | {
      readonly kind: 'go';
      readonly id: SearchId;
      readonly set: ReplaySet;
      readonly agent: SearchAgent | null;
      readonly budget: SearchBudget;
      readonly calibrates: boolean;
      readonly objective: SearchObjective;
      readonly split: HeldOutSplit;
    };

export interface ReadinessInput {
  readonly set: ReplaySet;
  readonly schedule: StationSearchSchedule;
  readonly policy: SearchPolicy;
  readonly stationAgent: SearchAgent | null;
  readonly iterations: number | null;
  readonly agentless: boolean;
}

export class CheckSearchReadiness {
  constructor(
    private readonly refreshing: RefreshKeptSets,
    private readonly sets: ReplaySetRepository,
    private readonly healths: SetHealths,
    private readonly work: WorkPort,
    private readonly hash: HashPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async check(input: ReadinessInput): Promise<SearchReadiness> {
    const { policy } = input;

    await this.refreshing.refreshBefore(input.set.id);

    const set = (await this.sets.find(input.set.id)) ?? input.set;
    const standard = await this.healths.standardAt(set.station);
    const health = await this.healths.ofSet(set, standard);
    const budget = input.agentless
      ? SearchBudget.agentless({
          ceiling: policy.ceiling,
          repeats: policy.repeats,
        })
      : SearchBudget.automatic({
          ceiling: policy.ceiling,
          iterations: input.iterations,
          repeats: policy.repeats,
        });
    const id = SearchId.of(this.ids.generate());
    const split = this.splitOf(id, set, input.schedule);
    const calibrates =
      standard.fingerprint !== null &&
      (await this.healths.calibrationWanted(set, standard.fingerprint));
    const verdict = setVerdict({
      now: this.clock.now(),
      tooSmall: split === 'too-small',
      warnings: searchWarningsOf(health, standard.minGain, budget.repeats),
      freshHeldOut: split !== 'no-fresh',
      affordable:
        typeof split === 'string' || budget.affords(split, calibrates),
      agent: input.agentless ? null : this.agentOf(policy, input.stationAgent),
      needsAgent: !input.agentless,
    });

    if (verdict.kind === 'skip') {
      return verdict;
    }
    if (typeof split === 'string') {
      return {
        kind: 'skip',
        reason: split === 'too-small' ? 'set-too-small' : 'no-fresh-held-out',
        checkAfter: this.clock.now(),
      };
    }

    return {
      kind: 'go',
      id,
      set,
      agent: verdict.agent,
      budget,
      calibrates,
      objective: objectiveFor(policy.objective, health),
      split,
    };
  }

  private splitOf(
    id: SearchId,
    set: ReplaySet,
    schedule: StationSearchSchedule,
  ): SplitReading {
    try {
      return HeldOutSplit.drawn({
        searchId: id,
        entries: set.entries,
        hash: (text) => this.hash.sha256(text),
        excluding: schedule.searchedTasks,
      });
    } catch (error) {
      if (error instanceof SearchSetTooSmallError) {
        return 'too-small';
      }
      if (error instanceof NoFreshHeldOutError) {
        return 'no-fresh';
      }
      throw error;
    }
  }

  private agentOf(
    policy: SearchPolicy,
    stationAgent: SearchAgent | null,
  ): SearchAgent | null {
    const agent = policy.agent ?? stationAgent;

    return agent && !this.work.agentProblem(agent) ? agent : null;
  }
}
