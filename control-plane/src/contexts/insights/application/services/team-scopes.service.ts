import type { InsightsAccess } from '@insights/application/services/insights-access.service';
import type { TeamWindow } from '@insights/domain/repositories/run-record.repository';
import type { TeamAccess } from '@insights/domain/services/team-access';
import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

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
    const access = await this.access.accessFor(teamId, principal);

    return { access, period: InsightsPeriod.of(period, this.clock.now()) };
  }
}
