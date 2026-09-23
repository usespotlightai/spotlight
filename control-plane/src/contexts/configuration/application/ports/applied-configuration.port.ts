import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const APPLIED_CONFIGURATION = Symbol('APPLIED_CONFIGURATION');

export interface Applied {
  readonly teamId: TeamId;
  readonly skills: readonly ConfigurationFile[];
}

export interface AppliedConfigurationPort {
  of(teamId: TeamId): Promise<Applied>;
}
