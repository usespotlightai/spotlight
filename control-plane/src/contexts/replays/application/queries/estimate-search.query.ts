import type {
  SearchBudgetAsked,
  SearchObjectiveAsked,
} from '@replays/application/commands/start-search.command';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class EstimateSearchQuery {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly setId: string,
    readonly budget: SearchBudgetAsked,
    readonly objective: SearchObjectiveAsked,
    readonly principal: Principal,
  ) {}
}
