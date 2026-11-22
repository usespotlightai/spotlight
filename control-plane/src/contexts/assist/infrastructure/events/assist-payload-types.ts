import { AssistSessionOrdered } from '@assist/domain/events/assist-session-ordered.event';
import { AssistSessionSettled } from '@assist/domain/events/assist-session-settled.event';
import { AssistPurpose } from '@assist/domain/value-objects/assist-purpose.vo';
import { AssistSessionId } from '@assist/domain/value-objects/assist-session-id.vo';
import { AssistSessionKey } from '@assist/domain/value-objects/assist-session-key.vo';

export const ASSIST_PAYLOAD_TYPES = [
  AssistSessionOrdered,
  AssistSessionSettled,
  AssistPurpose,
  AssistSessionId,
  AssistSessionKey,
] as const;
