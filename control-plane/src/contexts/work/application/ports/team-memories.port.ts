import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const TEAM_MEMORIES = Symbol('TEAM_MEMORIES');

export interface TouchedFile {
  readonly repository: Repository;
  readonly path: string;
}

export interface BriefingPlace {
  readonly teamId: TeamId;
  readonly lineId: string | null;
  readonly stationId: string | null;
  readonly repositories: readonly Repository[];
  touched(): Promise<readonly TouchedFile[]>;
}

export interface BriefedMemory {
  readonly id: string;
  readonly handle: string;
  readonly kind: string;
  readonly body: string;
}

interface CutMemory {
  readonly id: string;
  readonly handle: string;
}

export interface BriefingSelection {
  readonly briefed: readonly BriefedMemory[];
  readonly cut: readonly CutMemory[];
}

export const NOTHING_REMEMBERED: BriefingSelection = { briefed: [], cut: [] };

export interface TeamMemoriesPort {
  forBriefing(place: BriefingPlace): Promise<BriefingSelection>;
}
