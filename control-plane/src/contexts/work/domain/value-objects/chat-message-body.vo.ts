import { InvalidChatMessageError } from '@work/domain/exceptions/invalid-chat-message.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import type { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';

const MAX_LENGTH = 20_000;

export class ChatMessageBody {
  private constructor(readonly value: string) {}

  static of(raw: string): ChatMessageBody {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidChatMessageError(
        'needs text, a file, a trace or a station to improve',
      );
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidChatMessageError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new ChatMessageBody(trimmed);
  }

  static given(
    raw: string,
    attachments: readonly Attachment[] = [],
    traces: readonly TraceReference[] = [],
    improving: ImprovedStation | null = null,
  ): ChatMessageBody {
    const names = attachments.map((each) => each.name).join(', ');
    const shared = TraceReference.distinct(traces);
    const traced = shared.map((each) => each.title.value).join(', ');

    return ChatMessageBody.of(
      raw.trim() ||
        [
          improving
            ? `Asked to improve ${improving.stationName.value} on ${improving.lineName.value}.`
            : '',
          names ? `Attached ${names}.` : '',
          traced
            ? `Shared the trace${shared.length > 1 ? 's' : ''} of ${traced}.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
    );
  }

  equals(other: ChatMessageBody): boolean {
    return this.value === other.value;
  }
}
