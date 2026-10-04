import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { describe, expect, it } from 'vitest';

const IMPLEMENTATION = ImprovedStation.rehydrate({
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  lineKey: LineKey.of('delivery'),
  lineName: LineName.of('Delivery'),
  stationId: StationId.of('station_1'),
  stationKey: StationKey.of('implementation'),
  stationName: StationName.of('Implementation'),
});

const RETRIES = TraceReference.of({
  taskId: TaskId.of('task_1'),
  title: TaskTitle.of('Retries back off'),
  teamId: TeamId.of('team_1'),
});

describe('ChatMessageBody.given', () => {
  it('keeps what the person wrote', () => {
    expect(
      ChatMessageBody.given('  Make it smaller.  ', [], [], IMPLEMENTATION)
        .value,
    ).toBe('Make it smaller.');
  });

  it('says which station it was asked to improve when nothing was written', () => {
    expect(ChatMessageBody.given('', [], [], IMPLEMENTATION).value).toBe(
      'Asked to improve Implementation on Delivery.',
    );
  });

  it('names the station before the traces it shares', () => {
    expect(ChatMessageBody.given('', [], [RETRIES], IMPLEMENTATION).value).toBe(
      'Asked to improve Implementation on Delivery. Shared the trace of Retries back off.',
    );
  });

  it('refuses a message that says nothing, attaches nothing and names nothing', () => {
    expect(() => ChatMessageBody.given('   ')).toThrow(InvalidChatMessageError);
  });
});
