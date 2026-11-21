import type { EventEnvelope } from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const anEnvelope = (
  id = 'event_1',
  recordedAt = new Date('2026-11-01T09:00:00.000Z'),
): EventEnvelope => ({ id, recordedAt });
