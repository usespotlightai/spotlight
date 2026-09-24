import { ProblemException } from '@platform/http/resources/problem.exception';
import { isReplayed } from '@platform/http/resources/replayed';
import {
  answerCreated,
  answerDeleted,
  answerUpdated,
  found,
} from '@platform/http/resources/resource-answers';
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
  ])('refuses a create that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => answerCreated('line', outcome, answer)),
    ).toMatchObject({ status, type: `urn:spotlight:problem:${slug}` });
  });

  it.each([
    [null, 404, 'not-found'],
    [INVALID, 422, 'invalid'],
    [{ outcome: 'moved-on' as const, currentVersion: 4 }, 409, 'moved-on'],
    [{ outcome: 'in-use' as const, reason: 'held' }, 409, 'in-use'],
  ])('refuses an update that came to %j', async (outcome, status, slug) => {
    expect(
      await problemOf(() => answerUpdated('line', outcome, answer)),
    ).toMatchObject({ status, type: `urn:spotlight:problem:${slug}` });
  });

  it('answers a delete with nothing, and refuses one that did not happen', async () => {
    expect(answerDeleted('line', { outcome: 'deleted' })).toBeUndefined();
    expect(
      await problemOf(() =>
        answerDeleted('line', { outcome: 'moved-on', currentVersion: 4 }),
      ),
    ).toMatchObject({ status: 409, currentVersion: 4 });
  });

  it('answers what it found, and 404 for nothing', async () => {
    expect(found('line', { id: 'x' }, (held) => held.id)).toBe('x');
    expect(
      await problemOf(() => found('line', null, (held) => held)),
    ).toMatchObject({ status: 404 });
  });
});
