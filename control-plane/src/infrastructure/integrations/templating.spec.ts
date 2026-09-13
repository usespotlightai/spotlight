import {
  compile,
  ExpressionFailedError,
} from '@infrastructure/integrations/expression';
import {
  asJson,
  requiredTextOf,
  requiredValueOf,
  type Structured,
  type Templated,
  textOf,
} from '@infrastructure/integrations/templating';
import { describe, expect, it } from 'vitest';

const at = 'actions.post.request.body';
const templated = (...parts: (string | ReturnType<typeof compile>)[]) =>
  ({ parts }) satisfies Templated;

const against = { ask: { body: 'The queue is stuck.' }, task: { count: 3n } };

describe('a templated string', () => {
  it('reads plain text as it is written', () => {
    expect(textOf(templated('https://slack.com/api'), against)).toBe(
      'https://slack.com/api',
    );
  });

  it('reads each piece into the text around it', () => {
    const held = templated(
      'Asked: ',
      compile('ask.body', { at }),
      ' (',
      compile('task.count', { at }),
      ')',
    );

    expect(requiredTextOf(held, against)).toBe(
      'Asked: The queue is stuck. (3)',
    );
  });

  it('reads a lone expression as its own value', () => {
    expect(textOf(templated(compile('ask.body')), against)).toBe(
      'The queue is stuck.',
    );
    expect(textOf(templated(compile('ask.nothing')), against)).toBeNull();
  });

  it('reads what cannot be read as nothing, or refuses it where it is required', () => {
    const held = templated('Asked: ', compile('ask.nothing', { at }));

    expect(textOf(held, against)).toBe('Asked: ');
    expect(() => requiredTextOf(held, against)).toThrow(ExpressionFailedError);
  });
});

describe('a structured value', () => {
  it('reads a map and list as the structure written, pieces read in', () => {
    const held: Structured = {
      kind: 'map',
      entries: [
        {
          key: 'text',
          value: {
            kind: 'templated',
            templated: templated(compile('ask.body')),
          },
        },
        { key: 'unfurl', value: { kind: 'value', value: false } },
        {
          key: 'tags',
          value: {
            kind: 'list',
            items: [{ kind: 'templated', templated: templated('queue') }],
          },
        },
      ],
    };

    expect(requiredValueOf(held, against)).toEqual({
      text: 'The queue is stuck.',
      unfurl: false,
      tags: ['queue'],
    });
  });

  it('keeps a lone expression’s value whole, however it is shaped', () => {
    const held: Structured = {
      kind: 'templated',
      templated: templated(compile('{"text": ask.body}')),
    };

    expect(requiredValueOf(held, against)).toEqual({
      text: 'The queue is stuck.',
    });
  });

  it('writes numbers CEL counted as JSON numbers', () => {
    expect(asJson({ count: 3n, name: 'queue' })).toBe(
      '{"count":3,"name":"queue"}',
    );
  });
});
