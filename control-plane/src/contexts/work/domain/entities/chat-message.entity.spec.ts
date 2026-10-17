import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const RUN = RunId.of('run_1');

const said = () =>
  ChatMessage.said({
    position: MessagePosition.of(0),
    by: UserId.of('user_1'),
    body: ChatMessageBody.of('Split it.'),
    at: NOW,
  });

describe('ChatMessage', () => {
  it('remembers the run it was delivered to', () => {
    const delivered = said().delivered(RUN, NOW);

    expect(delivered.undelivered).toBe(false);
    expect(delivered.wasDeliveredTo(RUN)).toBe(true);
    expect(delivered.wasDeliveredTo(RunId.of('run_2'))).toBe(false);
  });

  it('keeps the run it first went to', () => {
    const delivered = said()
      .delivered(RUN, NOW)
      .delivered(RunId.of('run_2'), NOW);

    expect(delivered.wasDeliveredTo(RUN)).toBe(true);
  });

  it('waits to be delivered again once taken back', () => {
    const back = said().delivered(RUN, NOW).takenBack();

    expect(back.undelivered).toBe(true);
    expect(back.wasDeliveredTo(RUN)).toBe(false);
  });

  it('cannot be taken back when it was never delivered to a run', () => {
    expect(() => said().takenBack()).toThrow(InconsistentStateError);
  });

  it('does not name a run it was delivered to without saying when', () => {
    expect(() =>
      ChatMessage.rehydrate({
        position: MessagePosition.of(0),
        kind: 'said',
        body: ChatMessageBody.of('Split it.'),
        at: NOW,
        author: UserId.of('user_1'),
        runId: null,
        attachments: [],
        traces: [],
        proposal: null,
        deliveredAt: null,
        deliveredTo: RUN,
      }),
    ).toThrow(InconsistentStateError);
  });
});
