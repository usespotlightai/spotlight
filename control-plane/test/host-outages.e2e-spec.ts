import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { HostOutageLookup } from '@runners/application/services/host-outages.service';
import { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';
import { HostOutageVersionConflictError } from '@runners/domain/exceptions/host-outage-version-conflict.error';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostOutageId } from '@runners/domain/value-objects/host-outage-id.vo';
import { DrizzleHostOutageRepository } from '@runners/infrastructure/persistence/drizzle/repositories/host-outage.repository';
import { HOST_OUTAGE_BEGAN } from '@shared-kernel/application/integration-events/host-outage-began.integration-event';
import { HOST_OUTAGE_ENDED } from '@shared-kernel/application/integration-events/host-outage-ended.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReopenNoticeHandler } from '@work/application/commands/handlers/reopen-notice.handler';
import { ResolveNoticeHandler } from '@work/application/commands/handlers/resolve-notice.handler';
import { ReopenNoticeCommand } from '@work/application/commands/reopen-notice.command';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import { TellAdminsOfHostOutages } from '@work/application/events/handlers/tell-admins-of-host-outages.handler';
import { NoticeLoader } from '@work/application/services/notice-loader.service';
import { Notices } from '@work/application/services/notices.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import type { WorkAccess } from '@work/application/services/work-access.service';
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
let context: DrizzleContext;
let outages: DrizzleHostOutageRepository;
let notices: DrizzleNoticeRepository;
const dispatched: DomainEvent[] = [];

beforeAll(async () => {
  database = await openDatabase('host_outages');
  context = new DrizzleContext(database.db);
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
      autoResolve: true,
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
    expect((await about(workspaceId))?.autoResolve).toBe(true);
    expect(await about(WorkspaceId.of(randomUUID()))).toBeNull();
  });
});

describe('the notice of a host outage', () => {
  it('refuses an admin who resolves or reopens it, and stays open until the outage ends', async () => {
    const workspaceId = WorkspaceId.of(randomUUID());
    const source = CredentialSource.of('pool', randomUUID());
    const outage = outageOf(source, workspaceId);
    const clock = { now: () => RAISED_AT, sleep: async () => {} };
    const admin = partial<WorkAccess>({
      ...workAccessSeeing(() => false, { admin: true }),
      memberWorkspaceAt: async () => workspaceId,
    });
    const loader = new NoticeLoader(notices, admin);
    const telling = new TellAdminsOfHostOutages(
      new HostOutageLookup(outages),
      new Notices(notices, admin, context, { generate: randomUUID }, clock),
    );
    const noticeOf = () =>
      notices.about({
        workspaceId,
        teamId: null,
        addressee: null,
        form: 'advice',
        subject: NoticeSubject.of(`host-outage ${outage.id.value}`),
      });

    await outages.add(outage);
    await telling.began({
      kind: HOST_OUTAGE_BEGAN,
      outageId: outage.id.value,
      workspaceId: workspaceId.value,
      source: 'pool',
      sourceId: source.id,
      sourceKey: 'default',
      hosts: ['dev-host'],
      since: SINCE.toISOString(),
    });

    const raised = await noticeOf();

    if (!raised) {
      throw new Error('expected the notice of the outage');
    }

    expect(raised.autoResolve).toBe(true);
    await expect(
      new ResolveNoticeHandler(loader, notices, clock).execute(
        new ResolveNoticeCommand(raised.id.value, 'acme', 'user_admin'),
      ),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect((await noticeOf())?.resolvedAt).toBeNull();

    const stored = await outages.ofSource(source);

    if (!stored) {
      throw new Error('expected the stored outage');
    }

    await outages.remove(stored.end(RAISED_AT));
    await telling.ended({
      kind: HOST_OUTAGE_ENDED,
      outageId: outage.id.value,
      workspaceId: workspaceId.value,
      source: 'pool',
      sourceId: source.id,
    });

    expect((await noticeOf())?.resolvedAt).toEqual(RAISED_AT);
    await expect(
      new ReopenNoticeHandler(loader, notices, clock).execute(
        new ReopenNoticeCommand(raised.id.value, 'acme', 'user_admin'),
      ),
    ).rejects.toMatchObject({ kind: 'conflict' });
    expect((await noticeOf())?.resolvedAt).toEqual(RAISED_AT);
  });
});
