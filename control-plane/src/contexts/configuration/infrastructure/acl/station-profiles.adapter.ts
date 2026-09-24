import type { HarnessProfileCompilerPort } from '@configuration/application/ports/harness-profile-compiler.port';
import type { HarnessProfileResourcesPort } from '@configuration/application/ports/harness-profile-resources.port';
import { HarnessProfileShapeMapper } from '@configuration/infrastructure/acl/harness-profile-shape.mapper';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HarnessProfileShape } from '@work/application/contracts/harness-profile.contract';
import type { StationProfilesPort } from '@work/application/ports/station-profiles.port';

export class StationProfiles implements StationProfilesPort {
  constructor(
    private readonly resources: HarnessProfileResourcesPort,
    private readonly compiler: HarnessProfileCompilerPort,
  ) {}

  async named(
    teamId: TeamId,
    key: string,
  ): Promise<HarnessProfileShape | null> {
    const kept = await this.resources.at(teamId, key);
    const read = kept ? this.compiler.read(kept.definition) : null;

    return read?.ok ? HarnessProfileShapeMapper.toShape(read) : null;
  }
}
