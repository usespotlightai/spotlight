import { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import { ConfigurationHomeMovedOnError } from '@configuration/domain/exceptions/configuration-home-moved-on.error';
import { DrizzleConfigurationHome } from '@configuration/infrastructure/persistence/drizzle/repositories/configuration-home.repository';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const TEAM = TeamId.of('team_1');
const OLD = Repository.of('acme/old');
const NEW = Repository.of('acme/new');
const OTHER = Repository.of('acme/other');

type Row = Record<string, unknown> & { teamId: string; version: number };

const dialect = new PgDialect();

const keeping = () => {
  const rows = new Map<string, Row>();
  const recorded: DomainEvent[] = [];

  const db = {
    insert: () => ({
      values: (written: Row) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (rows.has(written.teamId)) {
              return [];
            }

            rows.set(written.teamId, { ...written, version: 1 });

            return [{ teamId: written.teamId }];
          },
        }),
      }),
    }),
    update: () => ({
      set: (written: Partial<Row>) => ({
        where: (condition: SQL) => ({
          returning: async () => {
            const [teamId, version] = dialect.sqlToQuery(condition).params;
            const row = rows.get(teamId as string);

            if (!row || row.version !== version) {
              return [];
            }

            rows.set(row.teamId, { ...row, ...written });

            return [{ teamId: row.teamId }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: (condition: SQL) => ({
          limit: async () => {
            const [teamId] = dialect.sqlToQuery(condition).params;
            const row = rows.get(teamId as string);

            return row ? [row] : [];
          },
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

  const homes = new DrizzleConfigurationHome(context, events);

  return {
    homes,
    recorded,
    read: async () => (await homes.find(TEAM)) as ConfigurationHome,
  };
};

const kinds = (recorded: readonly DomainEvent[]) =>
  recorded.map((each) => each.kind);

describe('DrizzleConfigurationHome', () => {
  it('keeps a home first written at its first version', async () => {
    const { homes, read } = keeping();

    await homes.save(ConfigurationHome.unpinned(WORKSPACE, TEAM).keptInto(OLD));

    expect((await read()).version).toBe(1);
    expect((await read()).keptIn?.value).toBe('acme/old');
  });

  it('refuses a second first pin made without seeing the first, and records nothing for it', async () => {
    const { homes, read, recorded } = keeping();

    await homes.save(ConfigurationHome.unpinned(WORKSPACE, TEAM).keptInto(OLD));

    await expect(
      homes.save(ConfigurationHome.unpinned(WORKSPACE, TEAM).keptInto(OTHER)),
    ).rejects.toThrow(ConfigurationHomeMovedOnError);
    expect((await read()).keptIn?.value).toBe('acme/old');
    expect(kinds(recorded)).toEqual(['configuration.pinned']);
  });

  it('refuses a move read before a pin landed, and records no move for it', async () => {
    const { homes, read, recorded } = keeping();
    await homes.save(ConfigurationHome.unpinned(WORKSPACE, TEAM).keptInto(OLD));
    recorded.length = 0;

    const mover = await read();
    await homes.save((await read()).keptInto(OTHER));

    await expect(homes.save(mover.movesTo(NEW, null))).rejects.toThrow(
      ConfigurationHomeMovedOnError,
    );
    expect((await read()).keptIn?.value).toBe('acme/other');
    expect((await read()).movingTo).toBeNull();
    expect(kinds(recorded)).toEqual(['configuration.pinned']);
  });

  it('refuses to finish a move that was given up while it landed', async () => {
    const { homes, read } = keeping();
    await homes.save(ConfigurationHome.unpinned(WORKSPACE, TEAM).keptInto(OLD));
    await homes.save((await read()).movesTo(NEW, null));

    const lander = await read();
    await homes.save((await read()).keptInto(OTHER));

    await expect(homes.save(lander.finishesMoving())).rejects.toThrow(
      ConfigurationHomeMovedOnError,
    );
    expect((await read()).keptIn?.value).toBe('acme/other');
    expect((await read()).version).toBe(3);
  });
});
