import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { TeamWindow } from '@outcomes/domain/repositories/run-record.repository';
import type { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export interface TeamScope {
  readonly clearance: OutcomesClearance;
  readonly period: InsightsPeriod;
}

export const windowOf = (
  clearance: OutcomesClearance,
  window: { readonly from: Date; readonly to: Date },
): TeamWindow => ({
  workspaceId: clearance.workspaceId,
  teamId: clearance.teamId,
  from: window.from,
  to: window.to,
});

export class TeamScopes {
  constructor(
    private readonly access: OutcomesAccess,
    private readonly clock: ClockPort,
  ) {}

  async scope(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamScope> {
    const clearance = await this.access.clearanceFor(teamId, principal);

    return { clearance, period: InsightsPeriod.of(period, this.clock.now()) };
  }
}
