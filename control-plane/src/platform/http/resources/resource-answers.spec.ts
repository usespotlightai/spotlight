import { ProblemException } from '@platform/http/resources/problem.exception';
import { isReplayed } from '@platform/http/resources/replayed';
import {
  answerCreated,
  answerDeleted,
  answerUpdated,
  found,
  listed,
} from '@platform/http/resources/resource-answers';
import { forbiddenTo } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { describe, expect, it } from 'vitest';

const answer = async (id: string) => ({ id });

const problemOf = async (answering: () => unknown) => {
  try {
    await answering();
  } catch (error) {
    if (error instanceof ProblemException) {
      return error.problem;
    }

    throw error;
  }

  throw new Error('answered');
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

describe('resource answers', () => {
  it('answers a create with the resource, marked when it is a replay', async () => {
    const first = await answerCreated(
      'line',
      { outcome: 'created', id: 'line_1', replayed: false },
      answer,
    );
    const again = await answerCreated(
      'line',
      { outcome: 'created', id: 'line_1', replayed: true },
      answer,
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
    [{ outcome: 'taken' as const, address: 'core/x' }, 409, 'already-exists'],
    [{ outcome: 'key-reused' as const }, 422, 'idempotency-key-reused'],
    [forbiddenTo('configure'), 403, 'forbidden'],
  ])('refuses a create that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => answerCreated('line', outcome, answer)),
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
  ])('refuses an update that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => answerUpdated('line', outcome, answer)),
    ).toMatchObject({ status, type: `urn:spotlight:problem:${slug}` });
  });

  it('says why a refusal was forbidden, by what it was forbidden to do', async () => {
    expect(
      await problemOf(() =>
        answerCreated('workspace', forbiddenTo('open-workspaces'), answer),
      ),
    ).toMatchObject({
      status: 403,
      detail: expect.stringContaining(
        'A workspace token cannot open a workspace',
      ),
    });
    expect(
      await problemOf(() =>
        answerDeleted('workspace', forbiddenTo('administer')),
      ),
    ).toMatchObject({
      status: 403,
      detail: expect.stringContaining('A token can never administer'),
    });
  });

  it.each([
    ['configure', 'Not allowed to change the secret'],
    ['manage-secrets', 'Not allowed to change the secret'],
    ['manage-runners', 'Not allowed to change the secret'],
    ['manage-token-trusts', 'Not allowed to change the secret'],
    ['administer', 'Not allowed to administer the secret'],
  ] as const)(
    'names the permission %s a refusal lacked, whatever its title says',
    async (act, title) => {
      for (const refusing of [
        () => answerCreated('secret', forbiddenTo(act), answer),
        () => answerUpdated('secret', forbiddenTo(act), answer),
        () => answerDeleted('secret', forbiddenTo(act)),
      ]) {
        expect(await problemOf(refusing)).toMatchObject({
          type: 'urn:spotlight:problem:forbidden',
          status: 403,
          title,
          permission: act,
        });
      }
    },
  );

  it('names no permission on a problem that is not a refusal', async () => {
    expect(
      await problemOf(() =>
        answerUpdated(
          'line',
          { outcome: 'version-conflict', currentVersion: 4 },
          answer,
        ),
      ),
    ).not.toHaveProperty('permission');
  });

  it('answers a delete with nothing, and refuses one that did not happen', async () => {
    expect(answerDeleted('line', { outcome: 'deleted' })).toBeUndefined();
    expect(
      await problemOf(() =>
        answerDeleted('line', {
          outcome: 'version-conflict',
          currentVersion: 4,
        }),
      ),
    ).toMatchObject({ status: 409, currentVersion: 4 });
  });

  it('answers what it found, and 404 for nothing', async () => {
    expect(found('line', { id: 'x' }, (row) => row.id)).toBe('x');
    expect(
      await problemOf(() => found('line', null, (row) => row)),
    ).toMatchObject({ status: 404 });
  });

  it('lists what it found in address order, and 404 for a workspace it may not see', async () => {
    expect(
      listed(['core/b', 'ops/a', 'core/a', 'Core/c'], (address) => ({
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
      await problemOf(() => listed(null, (address: string) => ({ address }))),
    ).toMatchObject({ status: 404, title: 'No such workspace' });
  });
});
