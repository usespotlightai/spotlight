export const SEARCH_OBJECTIVES = ['success', 'cost'] as const;

export type SearchObjective = (typeof SEARCH_OBJECTIVES)[number];
