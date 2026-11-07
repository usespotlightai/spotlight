import { InvalidToolInputsError } from '@integrations/domain/exceptions/invalid-tool-inputs.error';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import {
  ProvidedTool,
  type ProvidedToolInput,
} from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
import { ToolInputs } from '@integrations/domain/value-objects/tool-inputs.vo';
import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { describe, expect, it } from 'vitest';

const input = (over: Partial<ProvidedToolInput> = {}): ProvidedToolInput => ({
  name: 'body',
  schema: InputSchema.ofType('string'),
  description: null,
  required: true,
  defaulted: false,
  stdin: false,
  ...over,
});

const COMMENT = ProvidedTool.of({
  integration: IntegrationKey.of('linear'),
  name: 'comment',
  description: 'Comment on the issue.',
  inputs: [
    input(),
    input({
      name: 'count',
      schema: InputSchema.ofType('integer'),
      required: false,
    }),
    input({ name: 'team', required: false }),
  ],
  backing: ToolBacking.action('comment'),
});

const none = () => undefined;

const refusal = (
  written: unknown,
  defaultFor: (name: string) => unknown = none,
) => {
  try {
    ToolInputs.of(COMMENT, written, defaultFor);
  } catch (error) {
    return error instanceof InvalidToolInputsError ? error.because : error;
  }

  return null;
};

describe('ToolInputs', () => {
  it('takes the inputs a tool declares, coercing each to its schema', () => {
    expect(
      ToolInputs.of(COMMENT, { body: 'Looks safe', count: '3' }, none).values,
    ).toEqual({ body: 'Looks safe', count: 3 });
  });

  it('fills an input left out with its default', () => {
    expect(
      ToolInputs.of(COMMENT, { body: 'Hi' }, (name) =>
        name === 'team' ? 'core' : undefined,
      ).values,
    ).toEqual({ body: 'Hi', team: 'core' });
  });

  it('refuses an input the tool does not take', () => {
    expect(refusal({ body: 'Hi', colour: 'red' })).toBe(
      'linear.comment takes no input called colour',
    );
  });

  it('refuses to leave out a required input, empty counting as left out', () => {
    expect(refusal({})).toBe('linear.comment needs its body input');
    expect(refusal({ body: '' })).toBe('linear.comment needs its body input');
  });

  it('refuses a value its schema does not take', () => {
    expect(refusal({ body: 'Hi', count: 'many' })).toMatch(
      /^linear\.comment takes count, and "many" /,
    );
  });

  it('reads anything but an object as no inputs at all', () => {
    expect(refusal(['Hi'])).toBe('linear.comment needs its body input');
  });

  it('equals inputs with the same values', () => {
    expect(
      ToolInputs.of(COMMENT, { body: 'Hi' }, none).equals(
        ToolInputs.of(COMMENT, { body: 'Hi' }, none),
      ),
    ).toBe(true);
  });
});
