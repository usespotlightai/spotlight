import { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import type { ConfigurationRead } from '@configuration/domain/events/configuration-read.event';
import { Commit } from '@configuration/domain/value-objects/commit.vo';
import { DrizzleTeamConfiguration } from '@configuration/infrastructure/persistence/drizzle/repositories/team-configuration.repository';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const EARLIER = new Date('2026-09-17T09:00:00.000Z');
const LATER = new Date('2026-09-17T09:00:05.000Z');
const DONE = new Date('2026-09-17T09:00:30.000Z');

type Row = Record<string, unknown> & { teamId: string; begunAt: Date };

const dialect = new PgDialect();

const keeping = () => {
  const rows = new Map<string, Row>();
  const recorded: DomainEvent[] = [];
  const conditions: string[] = [];

  const db = {
    insert: () => ({
      values: (written: Row) => ({
        onConflictDoUpdate: (upsert: { set: Partial<Row>; setWhere: SQL }) => ({
          returning: async () => {
            conditions.push(dialect.sqlToQuery(upsert.setWhere).sql);
            const standing = rows.get(written.teamId);

            if (!standing) {
              rows.set(written.teamId, written);
              return [{ teamId: written.teamId }];
            }

            if (standing.begunAt < written.begunAt) {
              rows.set(written.teamId, { ...standing, ...upsert.set });
              return [{ teamId: written.teamId }];
            }

            return [];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [...rows.values()],
        }),
      }),
    }),
  };

  const context = {
    db,
    run: <T>(work: () => Promise<T>) => work(),
  } as unknown as DrizzleContext;

  const events: DomainEventDispatcher = {
    dispatch: async (dispatched) => {
      recorded.push(...dispatched);
    },
  };

  return {
    configurations: new DrizzleTeamConfiguration(context, events),
    recorded,
    conditions,
  };
};

const begun = (at: Date, sha: string) =>
  TeamConfiguration.read({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TEAM,
    repository: Repository.of('acme/config'),
    commit: Commit.of(sha),
    files: [],
    begunAt: at,
    readAt: DONE,
  }).assessedWith({ problems: [], integrations: [] });

const commitsRead = (recorded: readonly DomainEvent[]) =>
  (recorded as ConfigurationRead[]).map((each) => each.commit.value);

describe('DrizzleTeamConfiguration', () => {
  it('keeps a team’s first reading, and says it was read', async () => {
    const { configurations, recorded } = keeping();

    await expect(configurations.save(begun(EARLIER, 'aaaaaaa'))).resolves.toBe(
      'kept',
    );
    expect(commitsRead(recorded)).toEqual(['aaaaaaa']);
  });

  it('replaces a reading with one begun after it', async () => {
    const { configurations, recorded } = keeping();

    await configurations.save(begun(EARLIER, 'aaaaaaa'));

    await expect(configurations.save(begun(LATER, 'bbbbbbb'))).resolves.toBe(
      'kept',
    );
    expect((await configurations.findFor(TEAM))?.commit.value).toBe('bbbbbbb');
    expect(commitsRead(recorded)).toEqual(['aaaaaaa', 'bbbbbbb']);
  });

  it('drops an older reading that finishes last, and records no configuration.read for it', async () => {
    const { configurations, recorded } = keeping();
    const older = begun(EARLIER, 'aaaaaaa');
    const newer = begun(LATER, 'bbbbbbb');

    await configurations.save(newer);

    await expect(configurations.save(older)).resolves.toBe('superseded');
    expect((await configurations.findFor(TEAM))?.commit.value).toBe('bbbbbbb');
    expect(commitsRead(recorded)).toEqual(['bbbbbbb']);
    expect(older.pullEvents()).toEqual([]);
  });

  it('leaves the choosing to the database, by when each reading began', async () => {
    const { configurations, conditions } = keeping();

    await configurations.save(begun(EARLIER, 'aaaaaaa'));

    expect(conditions).toEqual([
      '"team_config"."begun_at" < excluded.begun_at',
    ]);
  });
});
