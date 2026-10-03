import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export interface SearchAgentAsked {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchBudgetAsked {
  readonly iterations: number;
  readonly perIteration: number;
  readonly ceiling: { readonly amount: number; readonly currency: string };
  readonly concurrency: number | null;
  readonly repeats: number | null;
}

export class StartSearchCommand {
  constructor(
    readonly teamId: string,
    readonly lineId: string,
    readonly stationId: string,
    readonly setId: string,
    readonly agent: SearchAgentAsked,
    readonly budget: SearchBudgetAsked,
    readonly actor: Actor,
  ) {}
}
