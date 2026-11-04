import type { GainEstimateResponseDto } from '@/lib/api';

export type GainEstimate = GainEstimateResponseDto;

export type ReplayedStation = {
  readonly slug: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
};
