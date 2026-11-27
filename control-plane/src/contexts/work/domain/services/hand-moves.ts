import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { OpenAsk } from '@work/domain/services/conversation-audience';
import {
  type HeldFor,
  type HoldViewer,
  HoldRights,
} from '@work/domain/services/hold-rights';
import { PassOn } from '@work/domain/services/pass-on';
import { SendBack } from '@work/domain/services/send-back';
import type { MoveDenial } from '@work/domain/value-objects/line-denial';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface HandMovedTask {
  readonly stationId: StationId;
  readonly hold: HeldFor | null;
  readonly awaiting: { readonly ask: OpenAsk | null } | null;
  readonly finished: boolean;
  readonly blocked: boolean;
}

export const HAND_MOVE_DENIALS = [
  'out-of-completed',
  'between-work-stations',
  'on-hold',
  'blocked',
] as const satisfies readonly (MoveDenial | 'on-hold' | 'blocked')[];

export type HandMoveDenial = (typeof HAND_MOVE_DENIALS)[number];

export interface HandMove {
  readonly to: Station;
  readonly denial: HandMoveDenial | null;
  readonly skips: readonly Station[];
  readonly sendsBack: boolean;
}

type EndsHold = (hold: HeldFor) => boolean;

// Only a task that has not started can start to wait for other tasks.
export const mayWaitAt = (station: Station): boolean => station.isBacklog;

// A blocked task waits in Backlog. It may still be parked there, or completed.
export const blockedMoveTo = (
  task: { readonly blocked: boolean },
  to: Station,
): boolean => task.blocked && !to.isBacklog && !to.isCompleted;

const denialBetween = (
  task: HandMovedTask,
  line: LineMap,
  from: Station,
  to: Station,
  endsHold: EndsHold,
): HandMoveDenial | null => {
  if (from.id.equals(to.id)) {
    return null;
  }
  if (task.hold && !endsHold(task.hold)) {
    return 'on-hold';
  }
  if (blockedMoveTo(task, to)) {
    return 'blocked';
  }
  if (SendBack.allows(task, line, to)) {
    return null;
  }

  const denial = line.moveDenial(from, to);

  if (
    denial === 'between-work-stations' &&
    PassOn.allows({ ...task, onHold: task.hold !== null }, line, to)
  ) {
    return null;
  }
  return denial;
};

export const HandMoves = {
  denial(
    task: HandMovedTask,
    line: LineMap,
    to: Station,
    mover: UserId,
  ): HandMoveDenial | null {
    const from = line.stationAt(task.stationId);

    if (!from) {
      throw new UnknownStationError(task.stationId.value);
    }

    return denialBetween(task, line, from, to, (hold) =>
      HoldRights.endableBy(hold, mover),
    );
  },

  of(
    task: HandMovedTask,
    line: LineMap | null,
    viewer: HoldViewer,
  ): readonly HandMove[] {
    const from = line?.stationAt(task.stationId) ?? null;

    if (!line || !from) {
      return [];
    }

    return line.stations.map((to) => {
      const denial = denialBetween(task, line, from, to, (hold) =>
        HoldRights.ends(hold, viewer),
      );

      return {
        to,
        denial,
        skips: denial ? [] : line.skips(from, to),
        sendsBack: denial === null && SendBack.allows(task, line, to),
      };
    });
  },
};
