import type {
  LineSearchResponseDto,
  RunStationResponseDto,
  StationResponseDto,
} from '@/lib/api';

export const LINE_SEARCH: LineSearchResponseDto = {
  enabled: true,
  monthlyCeiling: 50,
  currency: 'USD',
  ceiling: 10,
  period: '7d',
  onAlert: true,
  cooldown: '3d',
};

export const station = (
  over: Partial<StationResponseDto> & {
    id: string;
    key: string;
    name: string;
    position: number;
  },
): StationResponseDto => ({
  color: '#5c66d9',
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  judge: null,
  alerts: [],
  search:
    (over.kind ?? 'work') === 'work'
      ? {
          ...LINE_SEARCH,
          agent: null,
          iterations: null,
          repeats: null,
          objective: null,
        }
      : null,
  kind: 'work',
  skills: [],
  ...over,
});

export const runStationOf = (
  stations: readonly StationResponseDto[],
  stationId: string,
): RunStationResponseDto => {
  const found = stations.find((each) => each.id === stationId);

  return {
    id: stationId,
    name: found?.name ?? '',
    color: found?.color ?? '',
    position: found?.position ?? 0,
    count: stations.length,
  };
};
