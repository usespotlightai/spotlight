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

export interface SearchAgentRefusal {
  readonly field: 'harness' | 'model' | 'effort';
  readonly reason: string;
}

export type SearchDispatched =
  | { readonly outcome: 'queued' }
  | { readonly outcome: 'unstartable'; readonly reason: string };

export type UnclaimedWithdrawal =
  | { readonly outcome: 'withdrawn'; readonly started: boolean }
  | { readonly outcome: 'claimed' }
  | { readonly outcome: 'ended' };

export interface SearchDispatchPort {
  refusalOf(agent: SearchAgent): SearchAgentRefusal | null;

  enqueue(order: SearchOrder): Promise<SearchDispatched>;

  withdraw(runId: string): Promise<void>;

  withdrawUnclaimed(runId: string): Promise<UnclaimedWithdrawal>;
}
