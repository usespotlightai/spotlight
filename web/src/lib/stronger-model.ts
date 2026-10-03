import type { HarnessResponseDto } from '@/lib/api';
import type { Ceiling, HarnessOffer, StationLive } from '@/lib/replay';

export type StrongerSeed = {
  readonly model: string | null;
  readonly effort: string | null;
} | null;

export type StrongerPicks = { readonly model: string; readonly effort: string };

export type SanityAsked = {
  readonly stronger: { model?: string; effort?: string };
  readonly ceiling: Ceiling;
  readonly repeats: number;
};

export const firstStrongerPicks = (
  seed: StrongerSeed,
  live: StationLive,
): StrongerPicks => ({
  model: seed?.model ?? live.model ?? '',
  effort: seed?.effort ?? live.effort ?? '',
});

export const offerOf = (
  harnesses: readonly HarnessResponseDto[] | undefined,
  harness: string,
): HarnessOffer => {
  const offered = harnesses?.find((each) => each.id === harness);

  return {
    models: offered?.models.map((each) => each.id) ?? [],
    efforts: offered?.efforts ?? [],
  };
};

export const problemOnceTried = (
  tried: boolean,
  parsed: unknown,
): string | null => (tried && typeof parsed === 'string' ? parsed : null);

export const sanityAsked = (
  stronger: SanityAsked['stronger'] | null,
  problem: string | null,
  ceiling: Ceiling | string,
  repeats: number | string,
): SanityAsked | null =>
  !stronger ||
  problem !== null ||
  typeof ceiling === 'string' ||
  typeof repeats === 'string'
    ? null
    : { stronger, ceiling, repeats };
