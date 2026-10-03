export const SEARCH_OBJECTIVES = ['success', 'cost'] as const;

export type SearchObjective = (typeof SEARCH_OBJECTIVES)[number];

export const isSearchObjective = (held: unknown): held is SearchObjective =>
  (SEARCH_OBJECTIVES as readonly unknown[]).includes(held);
