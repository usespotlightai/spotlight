import type { HeldRunKind } from '@work/application/ports/runner-activity-reader.port';

export interface HeldRunDto {
  readonly id: string;
  readonly state: string;
  readonly kind: HeldRunKind;
  readonly teamId: string | null;
  readonly readable: boolean;
  readonly title: string | null;
}

export interface RunnerActivityDto {
  readonly runnerId: string;
  readonly currentRun: HeldRunDto;
}
