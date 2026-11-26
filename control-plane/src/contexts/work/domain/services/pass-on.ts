import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import {
  ConversationAudience,
  type OpenAsk,
} from '@work/domain/services/conversation-audience';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface PassedOnTask {
  readonly stationId: StationId;
  readonly onHold: boolean;
  readonly awaiting: { readonly ask: OpenAsk | null } | null;
}

const waitsOnAQuestion = (task: PassedOnTask): boolean =>
  !task.onHold &&
  ConversationAudience.asksAQuestion(task.awaiting?.ask ?? null);

export const PassOn = {
  allows(task: PassedOnTask, line: LineMap, to: Station): boolean {
    return (
      waitsOnAQuestion(task) && line.passDenial(task.stationId, to) === null
    );
  },

  targets(task: PassedOnTask, line: LineMap | null): readonly StationId[] {
    return line && waitsOnAQuestion(task)
      ? line.stations
          .filter((to) => PassOn.allows(task, line, to))
          .map((to) => to.id)
      : [];
  },
};
