import { sentryOptions } from '@platform/errors/sentry-options';
import type { Breadcrumb, ErrorEvent } from '@sentry/nestjs';
import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

const options = sentryOptions({ SENTRY_DSN: 'https://key@sentry.invalid/1' });

describe('sentryOptions', () => {
  it('sends the route of a request, never a token in its path', () => {
    const event = options?.beforeSend?.(
      {
        type: undefined,
        request: {
          url: 'https://app.example/api/invites/Zx81kQ_secret/accept',
        },
        breadcrumbs: [
          {
            category: 'http',
            data: { url: 'https://hooks.slack.com/services/T0/B0/secret' },
          },
        ],
      },
      {},
    ) as ErrorEvent;

    expect(event.request?.url).toBe(
      'https://app.example/api/invites/:id/accept',
    );
    expect(event.breadcrumbs?.[0]?.data?.url).toBe('https://hooks.slack.com');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('keeps only the origin of an outbound breadcrumb', () => {
    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'fetch',
      data: { url: 'https://api.github.com/repos/acme/app?access_token=x' },
    }) as Breadcrumb;

    expect(breadcrumb.data?.url).toBe('https://api.github.com');
  });

  const queryError = (query: string, code: string) =>
    new DrizzleQueryError(
      query,
      ['hello@example.com'],
      Object.assign(new Error('raised'), { code }),
    );

  const sendEvent = (error: DrizzleQueryError) =>
    options?.beforeSend?.(
      {
        type: undefined,
        exception: {
          values: [
            { type: 'error', value: 'raised' },
            { type: 'Error', value: error.message },
          ],
        },
      },
      { originalException: error },
    ) as ErrorEvent;

  const titleOf = (event: ErrorEvent) => {
    const values = event.exception?.values ?? [];

    return values[values.length - 1]?.value;
  };

  it('groups queries that fail because the database is unavailable', () => {
    const first = sendEvent(queryError('select "id" from "task"', '53300'));
    const second = sendEvent(queryError('select "id" from "run"', '53300'));

    expect(first.fingerprint).toEqual(['database-unavailable', '53300']);
    expect(second.fingerprint).toEqual(first.fingerprint);
    expect(titleOf(first)).toBe('The database is unavailable: 53300');
    expect(first.extra?.originalMessage).toBe(
      'Failed query: select "id" from "task"',
    );
  });

  it('keeps the grouping of a query that fails on its own', () => {
    const event = sendEvent(queryError('insert into "task"', '23505'));

    expect(event.fingerprint).toBeUndefined();
    expect(titleOf(event)).toBe('Failed query: insert into "task"');
  });

  it('never sends the parameters of a failed query', () => {
    const event = sendEvent(queryError('select 1', '53300'));

    expect(JSON.stringify(event)).not.toContain('hello@example.com');
  });

  it('groups a report the HTTP filter made with the query it failed on', () => {
    const report = Object.assign(
      new Error('The database refused a connection'),
      {
        cause: queryError('select "id" from "task"', '53300'),
      },
    );

    const event = options?.beforeSend?.(
      {
        type: undefined,
        exception: { values: [{ type: 'Error', value: report.message }] },
      },
      { originalException: report },
    ) as ErrorEvent;

    expect(event.fingerprint).toEqual(['database-unavailable', '53300']);
  });

  it('never sends the parameters of a failed query in a breadcrumb', () => {
    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'console',
      message: 'Failed query: select 1\nparams: hello@example.com',
    }) as Breadcrumb;

    expect(breadcrumb.message).toBe('Failed query: select 1');
  });

  it('never sends the parameters of a failed query a console call logged', () => {
    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'console',
      data: {
        arguments: ['Database failed:', queryError('select 1', '53300')],
      },
    }) as Breadcrumb;

    expect(breadcrumb.data?.arguments).toEqual([
      'Database failed:',
      'Error: Failed query: select 1',
    ]);
  });

  it('never sends the parameters of a failed query nested in a logged object', () => {
    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'console',
      data: {
        arguments: [{ err: queryError('select 1', '53300'), more: [1] }],
      },
    }) as Breadcrumb;

    expect(breadcrumb.data?.arguments).toEqual([
      { err: 'Error: Failed query: select 1', more: [1] },
    ]);
  });

  it('keeps a console argument that holds no failed query as it is', () => {
    class Point {
      constructor(readonly x: number) {}
    }
    const at = new Date('2026-11-14T12:00:00.000Z');
    const point = new Point(1);
    const unrelated = new Error('boom');
    const nested = { a: { b: { c: { d: 'deep' } } } };

    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'console',
      data: { arguments: ['at', at, point, unrelated, nested] },
    }) as Breadcrumb;
    const logged = breadcrumb.data?.arguments as unknown[];

    expect(logged[1]).toBe(at);
    expect(logged[2]).toBe(point);
    expect(logged[3]).toBe(unrelated);
    expect(logged[4]).toBe(nested);
  });

  it('strips an error that wraps a failed query', () => {
    const wrapper = Object.assign(new Error('Failed to get session'), {
      cause: queryError('select 1', '53300'),
    });

    const breadcrumb = options?.beforeBreadcrumb?.({
      category: 'console',
      data: { arguments: [wrapper] },
    }) as Breadcrumb;

    expect(breadcrumb.data?.arguments).toEqual([
      'Error: Failed to get session',
    ]);
  });

  it('never sends the parameters of a failed query in the event message', () => {
    const event = options?.beforeSend?.(
      { type: undefined, message: 'Failed query: select 1\nparams: x@y.z' },
      {},
    ) as ErrorEvent;

    expect(event.message).toBe('Failed query: select 1');
  });
});
