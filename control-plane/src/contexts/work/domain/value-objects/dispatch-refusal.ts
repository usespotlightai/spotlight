export const DISPATCH_REFUSALS = [
  'no-order',
  'order-refused',
  'withdrawn',
] as const;

export type DispatchRefusal = (typeof DISPATCH_REFUSALS)[number];
