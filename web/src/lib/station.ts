import type { StationResponseDto } from '@/lib/api';
import { assemblyLinePath } from '@/lib/team';

export type Station = StationResponseDto;

export type StationDraft = {
  readonly name: string;
  readonly description: string;
  readonly pool: string;
  readonly agentPrompt: string;
};

export const stationPath = (
  slug: string,
  teamId: string,
  lineId: string,
  stationId: string,
): string => `${assemblyLinePath(slug, teamId, lineId)}/stations/${stationId}`;
