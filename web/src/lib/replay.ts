import type {
  GainEstimateResponseDto,
  RateIntervalResponseDto,
} from '@/lib/api';

export type RateInterval = RateIntervalResponseDto;
export type GainEstimate = GainEstimateResponseDto;

export type ReplayedStation = {
  readonly slug: string;
  readonly teamId: string;
  readonly lineId: string;
  readonly stationId: string;
};
