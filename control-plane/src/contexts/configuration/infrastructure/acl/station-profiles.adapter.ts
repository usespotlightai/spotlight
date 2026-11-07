import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import { HarnessProfileShapeMapper } from '@configuration/infrastructure/acl/harness-profile-shape.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';

export class StationProfiles implements StationProfilesPort {
  constructor(private readonly resources: HarnessProfileResourcesPort) {}

  async named(
    teamId: TeamId,
    key: string,
  ): Promise<HarnessProfileShape | null> {
    const record = await this.resources.at(teamId, key);

    return record ? HarnessProfileShapeMapper.toShape(record) : null;
  }
}
