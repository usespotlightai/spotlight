import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { RunAudience } from '@work/application/ports/run-reader.port';
import type { ConversationViewer } from '@work/domain/services/conversation-audience';
import {
  MessageEffect,
  type StationFacts,
} from '@work/domain/services/message-effect';
import { RunStopPolicy } from '@work/domain/services/run-stop-policy';
import { RunWaits } from '@work/domain/services/run-waits';
import type { ViewerWaiting } from '@work/domain/services/task-waits';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';

export interface MessageReading {
  readonly viewer: ConversationViewer;
  readonly stationOf: (stationId: string) => StationFacts;
  readonly lineOf: (stationId: string) => LineMap | null;
}

export const messageReadingOf = (
  viewer: ConversationViewer,
  lines: readonly LineMap[],
): MessageReading => {
  const lineOf = (stationId: string): LineMap | null => {
    const id = StationId.of(stationId);

    return lines.find((each) => each.stationAt(id) !== null) ?? null;
  };

  return {
    viewer,
    lineOf,
    stationOf: (stationId) =>
      MessageEffect.stationOn(lineOf(stationId), StationId.of(stationId)),
  };
};

export const messageReadingOn = async (
  viewer: Promise<ConversationViewer>,
  lines: LineMapsPort,
  teamId: TeamId,
): Promise<MessageReading> => {
  const [found, maps] = await Promise.all([viewer, lines.ofTeam(teamId)]);

  return messageReadingOf(found, maps);
};

export const stoppableIn = (
  { run }: RunAudience,
  reading: MessageReading,
): boolean =>
  RunStopPolicy.allows(
    run,
    run.taskId && { id: run.taskId },
    reading.viewer.team,
  );

export const waitingIn = (
  { taskStationId, task, ...conversation }: RunAudience,
  reading: MessageReading,
): ViewerWaiting =>
  RunWaits.forViewer(
    {
      ...conversation,
      task: { ...task, ...reading.stationOf(taskStationId) },
    },
    reading.viewer,
  );
