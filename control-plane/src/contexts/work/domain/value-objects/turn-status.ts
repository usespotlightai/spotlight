export const TURN_STATUSES = ['pending', 'kept'] as const;

export type TurnStatus = (typeof TURN_STATUSES)[number];
