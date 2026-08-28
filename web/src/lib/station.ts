import type { StationResponseDto } from '@/lib/api';
import { assemblyLinePath } from '@/lib/team';

export type Station = StationResponseDto;

export type StationDraft = {
  readonly name: string;
  readonly description: string;
  readonly harness: string;
  readonly agentPrompt: string;
};

export const stationPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
): string => `${assemblyLinePath(slug, teamId, lineId)}/stations/${stationId}`;

export const stationShare = (place: number, count: number): number =>
  count > 1 ? place / (count - 1) : 1;

export const STATION_PALETTE = [
  '#a3a8b0',
  '#93a1b5',
  '#5c66d9',
  '#4bb3cd',
  '#56b98d',
  '#edc12b',
  '#e2894a',
  '#ce9f9c',
  '#db5b52',
] as const;
