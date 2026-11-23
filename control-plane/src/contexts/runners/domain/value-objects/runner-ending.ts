// How a runner ended: finished (its work ended while it still sent heartbeats), lost (it stopped sending heartbeats before its work ended), or released (Spotlight let it go before it claimed work).
export const RUNNER_ENDINGS = ['finished', 'lost', 'released'] as const;

export type RunnerEnding = (typeof RUNNER_ENDINGS)[number];
