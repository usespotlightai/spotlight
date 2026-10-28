export const SEARCH_TRIGGERS = ['schedule', 'alert'] as const;

export type SearchTrigger = (typeof SEARCH_TRIGGERS)[number];
