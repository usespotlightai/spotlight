import type { OutboxRecord } from '@shared-kernel/application/ports/domain-event-subscriber.port';

export const anOutboxRecord = (
  id = 'event_1',
  recordedAt = new Date('2026-11-01T09:00:00.000Z'),
): OutboxRecord => ({ id, recordedAt });
