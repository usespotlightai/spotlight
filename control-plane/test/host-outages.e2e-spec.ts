import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import { HostOutageVersionConflictError } from '@runners/domain/exceptions/host-outage-version-conflict.error';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { DrizzleHostOutageRepository } from '@runners/infrastructure/persistence/drizzle/repositories/host-outage.repository';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

const SINCE = new Date('2026-11-27T20:00:00.000Z');
const RAISED_AT = new Date('2026-11-27T20:05:00.000Z');

let database: TestDatabase;
let outages: DrizzleHostOutageRepository;
let notices: DrizzleNoticeRepository;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('host_outages');
  const context = new DrizzleContext(database.db);
  const events = {
    dispatch: async (events: readonly DomainEvent[]) => {
      dispatched.push(...events);
    },
  };
  outages = new DrizzleHostOutageRepository(context, events);
  notices = new DrizzleNoticeRepository(context, events);
}, 60_000);

afterAll(async () => {
  await database.close();
});

const outageOf = (source: CredentialSource, workspaceId: WorkspaceId) =>
  HostOutage.raise({
    id: HostOutageId.of(randomUUID()),
    workspaceId,
    outage: { source, hosts: ['dev-host'], since: SINCE },
    sourceKey: 'default',
    at: RAISED_AT,
  });

describe('DrizzleHostOutageRepository', () => {
  it('keeps one outage for each pool, with its hosts, and ends it with its event', async () => {
    const workspaceId = WorkspaceId.of(randomUUID());
    const source = CredentialSource.of('pool', randomUUID());
    const outage = outageOf(source, workspaceId);

    await outages.add(outage);
    await expect(outages.add(outageOf(source, workspaceId))).rejects.toThrow(
      HostOutageVersionConflictError,
    );

    const stored = await outages.ofSource(source);

    expect(stored?.id).toEqual(outage.id);
    expect(stored?.hosts).toEqual(['dev-host']);
    expect(stored?.since).toEqual(SINCE);

    if (!stored) {
      throw new Error('expected the stored outage');
    }

    await outages.remove(stored.end(RAISED_AT));

    expect(await outages.ofSource(source)).toBeNull();
    expect(dispatched.map((each) => each.kind)).toContain('host-outage.ended');
    await expect(outages.remove(stored)).rejects.toThrow(
      HostOutageVersionConflictError,
    );
  });

  it('tells a trust from a pool', async () => {
    const workspaceId = WorkspaceId.of(randomUUID());
    const trust = CredentialSource.of('trust', randomUUID());

    await outages.add(outageOf(trust, workspaceId));

    expect((await outages.ofSource(trust))?.source).toEqual(trust);
    expect(
      await outages.ofSource(CredentialSource.of('pool', trust.id)),
    ).toBeNull();
  });
});

describe('DrizzleNoticeRepository, for a notice about the whole workspace', () => {
  it('stores it without a team, and finds it by its workspace and subject only', async () => {
    const workspaceId = WorkspaceId.of(randomUUID());
    const subject = NoticeSubject.of(`host-outage pool:${randomUUID()}`);
    const notice = Notice.create({
      id: NoticeId.of(randomUUID()),
      workspaceId,
      teamId: null,
      addressee: null,
      form: 'advice',
      subject,
      link: NoticeLink.of({ path: 'settings/runners', label: 'Open runners' }),
      externalLink: null,
      wording: NoticeWording.of({
        headline: 'dev-host is offline',
        points: ['Start a host.'],
      }),
      at: RAISED_AT,
    });
    const about = (inWorkspace: WorkspaceId) =>
      notices.about({
        workspaceId: inWorkspace,
        teamId: null,
        addressee: null,
        form: 'advice',
        subject,
      });

    await notices.add(notice);

    expect((await about(workspaceId))?.id).toEqual(notice.id);
    expect((await about(workspaceId))?.teamId).toBeNull();
    expect(await about(WorkspaceId.of(randomUUID()))).toBeNull();
  });
});
