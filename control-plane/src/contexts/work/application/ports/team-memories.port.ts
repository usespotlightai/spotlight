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
  readonly about: string;
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

interface MemoryFolderRow {
  readonly folder: string;
  readonly holds: string;
}

export interface MemoryFolder {
  readonly path: string;
  readonly layout: readonly MemoryFolderRow[];
  readonly mirroring: string | null;
}

export interface BriefingSelection {
  readonly briefed: readonly BriefedMemory[];
  readonly cut: readonly CutMemory[];
  readonly folder: MemoryFolder | null;
}

export const NOTHING_REMEMBERED: BriefingSelection = {
  briefed: [],
  cut: [],
  folder: null,
};

export interface TeamMemoriesPort {
  forBriefing(place: BriefingPlace): Promise<BriefingSelection>;
}
