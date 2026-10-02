export const SEARCH_AGENTS = Symbol('SEARCH_AGENTS');

export interface SearchAgentShape {
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
}

export interface SearchAgentsPort {
  agentOf(searchId: string): Promise<SearchAgentShape | null>;
}
