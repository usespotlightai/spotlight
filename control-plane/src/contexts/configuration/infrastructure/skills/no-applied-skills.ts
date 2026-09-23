import type {
  Applied,
  AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class NoAppliedSkills implements AppliedConfigurationPort {
  async of(teamId: TeamId): Promise<Applied> {
    return { teamId, skills: [] };
  }
}
