import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  HEARD_HAPPENINGS,
  type HeardHappeningsPort,
} from '@work/application/ports/heard-happenings.port';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp } from './support/app';

describe('happenings heard, kept in the database (e2e)', () => {
  let app: INestApplication;
  let heard: HeardHappeningsPort;

  const OLD = new Date('2126-01-01T00:00:00.000Z');
  const NEW = new Date('2126-03-01T00:00:00.000Z');

  beforeAll(async () => {
    app = await openApp();
    heard = app.get<HeardHappeningsPort>(HEARD_HAPPENINGS);
  });

  afterAll(async () => {
    await app.close();
  });

  it('hears a happening once in a workspace, and again in another', async () => {
    const one = WorkspaceId.of(`ws_${randomUUID()}`);
    const two = WorkspaceId.of(`ws_${randomUUID()}`);
    const key = `delivery:slack:team:${randomUUID()}\n${'x'.repeat(5_000)}`;

    await expect(heard.hearing(one, key, NEW)).resolves.toBe(true);
    await expect(heard.hearing(one, key, NEW)).resolves.toBe(false);
    await expect(heard.heard(one, key)).resolves.toBe(true);
    await expect(heard.hearing(two, key, NEW)).resolves.toBe(true);
  });

  it('forgets no more than it is asked to at once, and only what was heard before the moment', async () => {
    const workspace = WorkspaceId.of(`ws_${randomUUID()}`);
    const old = ['a', 'b', 'c'].map((each) => `${each}:${randomUUID()}`);
    const kept = `kept:${randomUUID()}`;

    for (const key of old) {
      await heard.hearing(workspace, key, OLD);
    }
    await heard.hearing(workspace, kept, NEW);

    const before = new Date(OLD.getTime() + 1);
    const first = await heard.forgetBefore(before, 2);
    const rest = await heard.forgetBefore(before, 1_000);

    expect(first).toBe(2);
    expect(rest).toBeGreaterThanOrEqual(1);
    for (const key of old) {
      await expect(heard.heard(workspace, key)).resolves.toBe(false);
    }
    await expect(heard.heard(workspace, kept)).resolves.toBe(true);
  });
});
