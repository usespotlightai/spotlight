import { ProblemException } from '@platform/http/resources/problem.exception';
import { isReplayed } from '@platform/http/resources/replayed';
import {
  respondCreated,
  respondDeleted,
  respondFound,
  respondListed,
  respondUpdated,
} from '@platform/http/resources/resource-responses';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const toResponse = async (id: string) => ({ id });

const problemOf = async (responding: () => unknown) => {
  try {
    await responding();
  } catch (error) {
    if (error instanceof ProblemException) {
      return error.problem;
    }

    throw error;
  }

  throw new Error('responded');
};

const INVALID = {
  outcome: 'invalid' as const,
  problems: [
    ConfigurationProblem.of({
      path: 'x',
      at: FieldPath.of(['name']),
      reason: 'no',
    }),
  ],
};

describe('resource responses', () => {
  it('returns the resource for a create, marked when it is a replay', async () => {
    const first = await respondCreated(
      'line',
      { outcome: 'created', id: 'line_1', replayed: false },
      toResponse,
    );
    const again = await respondCreated(
      'line',
      { outcome: 'created', id: 'line_1', replayed: true },
      toResponse,
    );

    expect([first, isReplayed(first), isReplayed(again)]).toEqual([
      { id: 'line_1' },
      false,
      true,
    ]);
  });

  it.each([
    [null, 404, 'not-found'],
    [INVALID, 422, 'invalid'],
    [
      { outcome: 'already-exists' as const, address: 'core/x' },
      409,
      'already-exists',
    ],
    [
      { outcome: 'idempotency-key-reused' as const },
      422,
      'idempotency-key-reused',
    ],
    [forbiddenTo('configure'), 403, 'forbidden'],
  ])('rejects a create that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => respondCreated('line', outcome, toResponse)),
    ).toMatchObject({ status, type: `urn:spotlight:problem:${slug}` });
  });

  it.each([
    [null, 404, 'not-found'],
    [INVALID, 422, 'invalid'],
    [
      { outcome: 'version-conflict' as const, currentVersion: 4 },
      409,
      'version-conflict',
    ],
    [{ outcome: 'in-use' as const, reason: 'in use' }, 409, 'in-use'],
    [forbiddenTo('configure'), 403, 'forbidden'],
  ])('rejects an update that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => respondUpdated('line', outcome, toResponse)),
    ).toMatchObject({ status, type: `urn:spotlight:problem:${slug}` });
  });

  it('says why a request was forbidden, by what it was forbidden to do', async () => {
    expect(
      await problemOf(() =>
        respondCreated(
          'workspace',
          forbiddenTo('create-workspaces'),
          toResponse,
        ),
      ),
    ).toMatchObject({
      status: 403,
      detail: expect.stringContaining(
        'A workspace token cannot create a workspace',
      ),
    });
    expect(
      await problemOf(() =>
        respondDeleted('workspace', forbiddenTo('administer')),
      ),
    ).toMatchObject({
      status: 403,
      detail: expect.stringContaining('A token can never administer'),
    });
  });

  it.each([
    ['configure', 'Not allowed to change the secret'],
    ['secrets', 'Not allowed to change the secret'],
    ['runners', 'Not allowed to change the secret'],
    ['trusts', 'Not allowed to change the secret'],
    ['administer', 'Not allowed to administer the secret'],
  ] as const)(
    'names the permission %s a forbidden request lacked, whatever its title says',
    async (act, title) => {
      for (const forbidden of [
        () => respondCreated('secret', forbiddenTo(act), toResponse),
        () => respondUpdated('secret', forbiddenTo(act), toResponse),
        () => respondDeleted('secret', forbiddenTo(act)),
      ]) {
        expect(await problemOf(forbidden)).toMatchObject({
          type: 'urn:spotlight:problem:forbidden',
          status: 403,
          title,
          permission: act,
        });
      }
    },
  );

  it('names no permission on a problem that is not forbidden', async () => {
    expect(
      await problemOf(() =>
        respondUpdated(
          'line',
          { outcome: 'version-conflict', currentVersion: 4 },
          toResponse,
        ),
      ),
    ).not.toHaveProperty('permission');
  });

  it('returns nothing for a delete, and rejects one that did not happen', async () => {
    expect(respondDeleted('line', { outcome: 'deleted' })).toBeUndefined();
    expect(
      await problemOf(() =>
        respondDeleted('line', {
          outcome: 'version-conflict',
          currentVersion: 4,
        }),
      ),
    ).toMatchObject({ status: 409, currentVersion: 4 });
  });

  it('returns what it found, and 404 for nothing', async () => {
    expect(respondFound('line', { id: 'x' }, (row) => row.id)).toBe('x');
    expect(
      await problemOf(() => respondFound('line', null, (row) => row)),
    ).toMatchObject({ status: 404 });
  });

  it('lists what it found in address order, and 404 for a workspace it may not see', async () => {
    expect(
      respondListed(['core/b', 'ops/a', 'core/a', 'Core/c'], (address) => ({
        address,
      })),
    ).toEqual({
      items: [
        { address: 'Core/c' },
        { address: 'core/a' },
        { address: 'core/b' },
        { address: 'ops/a' },
      ],
    });
    expect(
      await problemOf(() =>
        respondListed(null, (address: string) => ({ address })),
      ),
    ).toMatchObject({ status: 404, title: 'No such workspace' });
  });
});
