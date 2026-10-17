export const SEARCH_DISPATCH = Symbol('SEARCH_DISPATCH');

export interface SearchAgent {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchOrder {
  readonly id: string;
  readonly searchId: string;
  readonly iteration: number;
  readonly lineId: string;
  readonly stationId: string;
  readonly agent: SearchAgent;
  readonly briefing: string;
}

export interface SearchAgentProblem {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export type SearchDispatched =
  | { readonly outcome: 'queued' }
  | { readonly outcome: 'unstartable'; readonly reason: string };

export type UnclaimedCancellation =
  | { readonly outcome: 'cancelled'; readonly started: boolean }
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'ended' };

export interface SearchDispatchPort {
  problemOf(agent: SearchAgent): SearchAgentProblem | null;

  enqueue(order: SearchOrder): Promise<SearchDispatched>;

  cancel(runId: string): Promise<void>;

  cancelUnclaimed(runId: string): Promise<UnclaimedCancellation>;
}
