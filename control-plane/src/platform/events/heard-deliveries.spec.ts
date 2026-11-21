import { heardDeliveries } from '@platform/events/heard-deliveries';
import { INTEGRATION_EVENT_KIND } from '@shared-kernel/application/integration-events/integration-event';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const query = (hearings: Parameters<typeof heardDeliveries>[0]) =>
  new PgDialect().sqlToQuery(heardDeliveries(hearings));

describe('heardDeliveries', () => {
  it('copies a pattern into SQL that has no flags, which SQL would drop', () => {
    expect(INTEGRATION_EVENT_KIND.flags).toBe('');
  });

  it('matches no delivery for no hearing, or for one that hears nothing', () => {
    expect(query([]).sql).toBe('false');
    expect(query([{ name: 'test.deaf', kinds: [], prefixes: [] }]).sql).toBe(
      'false',
    );
  });

  it('matches each subscriber with the kinds it names, or with its prefixes on integration event kinds only', () => {
    const { sql, params } = query([
      {
        name: 'test.named',
        kinds: ['task.opened', 'task.asked'],
        prefixes: [],
      },
      { name: 'test.sink', kinds: [], prefixes: ['identity.'] },
    ]);

    expect(sql).toBe(
      '(("event_delivery"."subscriber", "event_outbox"."kind") in (select * from unnest($1::text[], $2::text[])) or ("event_delivery"."subscriber" = $3 and "event_outbox"."kind" ~ $4 and "event_outbox"."kind" like $5))',
    );
    expect(params).toEqual([
      ['test.named', 'test.named'],
      ['task.opened', 'task.asked'],
      'test.sink',
      '^([a-z][a-z-]*)\\.[a-z][a-z-]*\\.v\\d+$',
      'identity.%',
    ]);
  });

  it('matches a sink that names kinds and has prefixes by both rules', () => {
    const { sql, params } = query([
      {
        name: 'test.sink',
        kinds: ['identity.user-joined.v1'],
        prefixes: ['bell.'],
      },
    ]);

    expect(sql).toBe(
      '(("event_delivery"."subscriber", "event_outbox"."kind") in (select * from unnest($1::text[], $2::text[])) or ("event_delivery"."subscriber" = $3 and "event_outbox"."kind" ~ $4 and "event_outbox"."kind" like $5))',
    );
    expect(params).toEqual([
      ['test.sink'],
      ['identity.user-joined.v1'],
      'test.sink',
      INTEGRATION_EVENT_KIND.source,
      'bell.%',
    ]);
  });

  it('keeps the same SQL however many subscribers name kinds, so Postgres plans each claim quickly', () => {
    const hearingsOf = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        name: `test.subscriber-${index}`,
        kinds: ['task.opened', 'task.asked'],
        prefixes: [],
      }));

    const few = query(hearingsOf(2));
    const many = query(hearingsOf(300));

    expect(many.sql).toBe(few.sql);
    expect(many.params).toHaveLength(2);
    expect(many.params[0]).toHaveLength(600);
    expect(many.params[1]).toHaveLength(600);
  });
});
