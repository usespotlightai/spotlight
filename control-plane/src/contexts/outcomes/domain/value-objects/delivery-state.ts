export const DELIVERY_STATES = ['open', 'merged', 'closed'] as const;

export type DeliveryState = (typeof DELIVERY_STATES)[number];
