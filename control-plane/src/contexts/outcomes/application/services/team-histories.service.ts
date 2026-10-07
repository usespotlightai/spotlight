import type { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import type { ChatRecordRepository } from '@outcomes/domain/repositories/chat-record.repository';
import type {
  RunRecordRepository,
  TeamWindow,
} from '@outcomes/domain/repositories/run-record.repository';
import type { TaskDeliveryRepository } from '@outcomes/domain/repositories/task-delivery.repository';
import type { TaskFailuresRepository } from '@outcomes/domain/repositories/task-failures.repository';
import type { TaskTouchesRepository } from '@outcomes/domain/repositories/task-touches.repository';
import type { CarriedConfigs } from '@outcomes/domain/services/config-stretches';
import type { OutcomesClearance } from '@outcomes/domain/services/outcomes-clearance';
import {
  latestStarted,
  stationsOf,
  type TeamHistory,
} from '@outcomes/domain/services/team-history';
import { InsightsPeriod } from '@outcomes/domain/value-objects/insights-period.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export const MOST_RECORDS = 20_000;

export interface TeamHistoryHeld {
  readonly records: RunRecordRepository;
  readonly deliveries: TaskDeliveryRepository;
  readonly touches: TaskTouchesRepository;
  readonly failures: TaskFailuresRepository;
  readonly chats: ChatRecordRepository;
}

export interface TeamScope {
  readonly clearance: OutcomesClearance;
  readonly period: InsightsPeriod;
}

export interface TeamHistoryInPeriod extends TeamScope {
  readonly history: TeamHistory;
  readonly runsFrom: Date;
  readonly truncated: boolean;
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

export class TeamHistories {
  constructor(
    private readonly access: OutcomesAccess,
    private readonly held: TeamHistoryHeld,
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

  async of(
    teamId: string,
    principal: Principal,
    period: string,
  ): Promise<TeamHistoryInPeriod> {
    const scope = await this.scope(teamId, principal, period);
    const window = windowOf(scope.clearance, scope.period.lookback);
    const most = MOST_RECORDS + 1;
    const records = await this.held.records.endedForTeam(window, most);
    const deliveries = await this.held.deliveries.ofTeamBetween(window, most);
    const touches = await this.held.touches.ofTeamBetween(window, most);
    const failures = await this.held.failures.ofTeamBetween(window, most);
    const chats = await this.held.chats.ofTeamBetween(window, most);
    const truncated = [records, deliveries, touches, failures, chats].some(
      (each) => each.length > MOST_RECORDS,
    );
    const kept = latestStarted(records, MOST_RECORDS, window.from);

    return {
      ...scope,
      truncated,
      runsFrom: kept.runsFrom,
      history: {
        records: kept.records,
        deliveries: deliveries.slice(0, MOST_RECORDS),
        touches: touches.slice(0, MOST_RECORDS),
        failures: failures.slice(0, MOST_RECORDS),
        chats: chats.slice(0, MOST_RECORDS),
      },
    };
  }

  async carriedOn(inPeriod: TeamHistoryInPeriod): Promise<CarriedConfigs> {
    const from = inPeriod.runsFrom;

    return {
      from,
      lastRuns: await this.held.records.lastConfigRunsBefore(
        inPeriod.clearance.teamId,
        stationsOf(inPeriod.history.records).map(({ stationId }) => ({
          stationId,
          from,
        })),
      ),
    };
  }
}
