import type {
  SearchBudgetInput,
  SearchObjectiveInput,
} from '@replays/application/commands/start-search.command';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class EstimateSearchQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly setId: string,
    readonly budget: SearchBudgetInput,
    readonly objective: SearchObjectiveInput,
    readonly principal: Principal,
  ) {}
}
