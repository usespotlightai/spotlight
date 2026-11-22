import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import {
  type Awaiting,
  ConversationAudience,
  type ConversationViewer,
} from '@work/domain/services/conversation-audience';
import { type HeldFor, HoldRights } from '@work/domain/services/hold-rights';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export const MESSAGE_OUTCOMES = [
  'answer',
  'drives',
  'holds',
  'reopens',
  'waits-for-chat',
  'message',
  'awaits-another',
  'moved-on',
  'not-acting',
  'not-on-team',
] as const;

export type MessageOutcome = (typeof MESSAGE_OUTCOMES)[number];

export interface MessagedTask {
  readonly running: boolean;
  readonly finished: boolean;
  readonly atCompleted: boolean;
  readonly harnessed: boolean;
  readonly hold: Pick<HeldFor, 'chat'> | null;
  readonly pending: Awaiting | null;
}

export interface MessageAddress {
  readonly toRun: boolean;
  readonly currentRun: boolean;
  readonly atTaskStation: boolean;
}

export type StationFacts = Pick<MessagedTask, 'harnessed' | 'atCompleted'>;

export interface AddressedRun {
  readonly current: boolean;
  readonly stationId: StationId | null;
}

export const TO_THE_TASK: MessageAddress = {
  toRun: false,
  currentRun: false,
  atTaskStation: true,
};

export const MessageEffect = {
  addressTo(
    run: AddressedRun | null,
    taskStationId: StationId,
  ): MessageAddress {
    if (run === null) {
      return TO_THE_TASK;
    }

    return {
      toRun: true,
      currentRun: run.current,
      atTaskStation: run.stationId?.equals(taskStationId) ?? false,
    };
  },

  stationOn(line: LineMap | null, stationId: StationId): StationFacts {
    return {
      harnessed: Boolean(line?.stationAt(stationId)?.harness),
      atCompleted: line === null || line.completed.id.equals(stationId),
    };
  },

  answers(running: boolean, to: MessageAddress): boolean {
    return to.currentRun || (!running && to.atTaskStation);
  },

  awaiting(task: MessagedTask, to: MessageAddress): Awaiting | null {
    return MessageEffect.answers(task.running, to) ? task.pending : null;
  },

  holds(task: MessagedTask, to: MessageAddress): boolean {
    return (
      task.hold === null &&
      !task.finished &&
      task.harnessed &&
      to.toRun &&
      to.atTaskStation &&
      (task.pending === null ||
        !ConversationAudience.answeredByMessage(task.pending.ask))
    );
  },

  reopens(task: MessagedTask, to: MessageAddress): boolean {
    return task.finished && !task.atCompleted && to.atTaskStation;
  },

  outcome(
    task: MessagedTask,
    to: MessageAddress,
    viewer: ConversationViewer,
  ): MessageOutcome {
    if (!viewer.team.actsOnTasks) {
      return 'not-acting';
    }

    if (!to.atTaskStation) {
      return 'moved-on';
    }

    const awaiting = MessageEffect.awaiting(task, to);
    const { hold } = task;

    if (
      awaiting !== null &&
      ConversationAudience.answeredByMessage(awaiting.ask) &&
      (hold === null || HoldRights.takesTurns(hold))
    ) {
      return ConversationAudience.answersAwaiting(
        awaiting,
        viewer,
        hold !== null && HoldRights.drives(hold, viewer),
      )
        ? 'answer'
        : 'awaits-another';
    }

    if (hold !== null) {
      return HoldRights.drives(hold, viewer) ? 'drives' : 'waits-for-chat';
    }

    if (MessageEffect.holds(task, to)) {
      return viewer.team.takesTasks ? 'holds' : 'not-on-team';
    }

    return MessageEffect.reopens(task, to) ? 'reopens' : 'message';
  },
};
