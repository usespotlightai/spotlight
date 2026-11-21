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
      { name: 'test.named', kinds: ['task.opened'], prefixes: [] },
      { name: 'test.sink', kinds: [], prefixes: ['identity.'] },
    ]);

    expect(sql).toBe(
      '(("event_delivery"."subscriber" = $1 and "event_outbox"."kind" in ($2)) or ("event_delivery"."subscriber" = $3 and ("event_outbox"."kind" ~ $4 and "event_outbox"."kind" like $5)))',
    );
    expect(params).toEqual([
      'test.named',
      'task.opened',
      'test.sink',
      '^([a-z][a-z-]*)\\.[a-z][a-z-]*\\.v\\d+$',
      'identity.%',
    ]);
  });
});
