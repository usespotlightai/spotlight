import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  PROCESSED_EVENTS,
  type ProcessedEventsPort,
} from '@work/application/ports/processed-events.port';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';

describe('processed events, stored in the database (e2e)', () => {
  let app: INestApplication;
  let processedEvents: ProcessedEventsPort;

  const OLD = new Date('2126-01-01T00:00:00.000Z');
  const NEW = new Date('2126-03-01T00:00:00.000Z');

  beforeAll(async () => {
    app = await openApp();
    processedEvents = app.get<ProcessedEventsPort>(PROCESSED_EVENTS);
  });

  afterAll(async () => {
    await app.close();
  });

  it('marks an event processed once in a workspace, and again in another', async () => {
    const one = WorkspaceId.of(`ws_${randomUUID()}`);
    const two = WorkspaceId.of(`ws_${randomUUID()}`);
    const key = `delivery:slack:team:${randomUUID()}\n${'x'.repeat(5_000)}`;

    await expect(processedEvents.markProcessed(one, key, NEW)).resolves.toBe(
      true,
    );
    await expect(processedEvents.markProcessed(one, key, NEW)).resolves.toBe(
      false,
    );
    await expect(processedEvents.wasProcessed(one, key)).resolves.toBe(true);
    await expect(processedEvents.markProcessed(two, key, NEW)).resolves.toBe(
      true,
    );
  });

  it('purges no more than its limit at once, and only what was processed before the moment', async () => {
    const workspace = WorkspaceId.of(`ws_${randomUUID()}`);
    const old = ['a', 'b', 'c'].map((each) => `${each}:${randomUUID()}`);
    const recent = `recent:${randomUUID()}`;

    for (const key of old) {
      await processedEvents.markProcessed(workspace, key, OLD);
    }
    await processedEvents.markProcessed(workspace, recent, NEW);

    const before = new Date(OLD.getTime() + 1);
    const first = await processedEvents.purgeBefore(before, 2);
    const rest = await processedEvents.purgeBefore(before, 1_000);

    expect(first).toBe(2);
    expect(rest).toBeGreaterThanOrEqual(1);
    for (const key of old) {
      await expect(processedEvents.wasProcessed(workspace, key)).resolves.toBe(
        false,
      );
    }
    await expect(processedEvents.wasProcessed(workspace, recent)).resolves.toBe(
      true,
    );
  });
});
