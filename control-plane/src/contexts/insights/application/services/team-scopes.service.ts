import type { TeamWindow } from '@insights/application/ports/insights-reader.port';
import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import type { TeamAccess } from '@insights/domain/value-objects/team-access.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface TeamScope {
  readonly access: TeamAccess;
  readonly period: InsightsPeriod;
}

export const windowOf = (
  access: TeamAccess,
  window: { readonly from: Date; readonly to: Date },
): TeamWindow => ({
  workspaceId: access.workspaceId,
  teamId: access.teamId,
  from: window.from,
  to: window.to,
});

export class TeamScopes {
  constructor(
    private readonly access: InsightsAccess,
    private readonly clock: ClockPort,
  ) {}

  async scope(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamScope> {
    const access = await this.access.accessFor(TeamId.of(teamId), principal);

    return { access, period: InsightsPeriod.of(period, this.clock.now()) };
  }
}
