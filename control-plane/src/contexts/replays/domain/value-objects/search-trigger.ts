export const SEARCH_TRIGGERS = ['schedule', 'alert', 'request'] as const;

export type SearchTrigger = (typeof SEARCH_TRIGGERS)[number];
