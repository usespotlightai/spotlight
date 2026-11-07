import type { StationChangeTestMode } from '@replays/application/contracts/station-change-tests.contract';
import type { LinesPort } from '@replays/application/ports/lines.port';
import { ImproveStation } from '@replays/application/rendering/improve-station';
import { StationChangeTestAnswer } from '@replays/application/rendering/station-change-test-answer';
import type { StationChangeTests } from '@replays/application/services/station-change-tests.service';
import type { JsonObject } from '@shared-kernel/domain/json-value';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const MODES: readonly StationChangeTestMode[] = ['test', 'search'];

export interface ImprovedStationTarget {
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly lineKey: string;
  readonly lineName: string;
  readonly stationId: StationId;
  readonly stationKey: string;
  readonly stationName: string;
}

export interface ImprovingChat {
  readonly workspaceId: WorkspaceId;
  readonly startedBy: UserId;
  readonly target: ImprovedStationTarget | null;
}

export interface StationChangeTestInputs {
  readonly line: string | null;
  readonly station: string | null;
  readonly mode: string | null;
  readonly name: string | null;
  readonly hypothesis: string | null;
  readonly config: string | null;
}

export interface StationChangeOffer {
  readonly offered: boolean;
  readonly briefing: string | null;
}

const isMode = (raw: string): raw is StationChangeTestMode =>
  (MODES as readonly string[]).includes(raw);

const blockOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export class TestStationChange {
  constructor(
    private readonly tests: StationChangeTests,
    private readonly lines: LinesPort,
  ) {}

  async offerFor(chat: ImprovingChat): Promise<StationChangeOffer> {
    const target = chat.target;

    if (!target) {
      return { offered: false, briefing: null };
    }

    return {
      offered: true,
      briefing: ImproveStation.section(
        target.stationName,
        await this.lines.namedStation(target.lineId, target.stationId),
      ),
    };
  }

  async call(
    chat: ImprovingChat,
    inputs: StationChangeTestInputs,
  ): Promise<JsonObject> {
    const target = chat.target;

    if (!target) {
      return StationChangeTestAnswer.refused(
        'not-improving',
        'This chat does not improve a station.',
      );
    }
    if (
      (inputs.line !== null && inputs.line !== target.lineKey) ||
      (inputs.station !== null && inputs.station !== target.stationKey)
    ) {
      return StationChangeTestAnswer.refused(
        'other-station',
        `This chat improves only the ${target.stationName} station (${target.stationKey}) on the ${target.lineName} line (${target.lineKey}).`,
      );
    }

    const mode = inputs.mode ?? 'test';

    if (!isMode(mode)) {
      return StationChangeTestAnswer.refused(
        'invalid-mode',
        `Mode ${mode} is not known. Use test or search.`,
      );
    }

    return StationChangeTestAnswer.of(
      await this.tests.request({
        workspaceId: chat.workspaceId,
        teamId: target.teamId,
        lineId: target.lineId.value,
        stationId: target.stationId.value,
        requester: chat.startedBy,
        mode,
        name: inputs.name ?? '',
        hypothesis: inputs.hypothesis ?? '',
        block: blockOf(inputs.config ?? ''),
      }),
    );
  }
}
