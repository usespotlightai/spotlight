import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import {
  ProvidedTool,
  type ProvidedToolInput,
} from '@integrations/domain/value-objects/provided-tool.vo';
import { ToolBacking } from '@integrations/domain/value-objects/tool-backing.vo';
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

const provided = (
  inputs: readonly ProvidedToolInput[],
  description = 'Comment on the issue.',
) =>
  ProvidedTool.of({
    integration: IntegrationKey.of('linear'),
    name: 'comment',
    description,
    inputs,
    backing: ToolBacking.action('comment'),
  });

describe('ProvidedTool', () => {
  it('is named for the integration offering it', () => {
    expect(provided([]).tool).toBe('linear.comment');
  });

  it('keeps what a tool is for, and what it takes', () => {
    const tool = provided([
      input({ name: 'issue', defaulted: true }),
      input({ stdin: true }),
    ]);

    expect(tool.description).toBe('Comment on the issue.');
    expect(tool.inputs.map((each) => each.name)).toEqual(['issue', 'body']);
  });

  it('rejects a tool that does not say what it is for', () => {
    expect(() => provided([], '  ')).toThrow(InvalidIntegrationError);
  });

  it('rejects an input named twice, or named unlike a flag', () => {
    expect(() => provided([input(), input()])).toThrow(InvalidIntegrationError);
    expect(() => provided([input({ name: '$filter' })])).toThrow(
      InvalidIntegrationError,
    );
    expect(() => provided([input({ name: 'json' })])).toThrow(
      /every input at once/,
    );
  });

  it('keeps an upstream input name as it is', () => {
    expect(
      provided([
        input({ name: 'teamId' }),
        input({ name: 'team_key' }),
      ]).inputs.map((each) => each.name),
    ).toEqual(['teamId', 'team_key']);
  });

  it('rejects a tool needing approval that takes intent, which the agent says what it wants to do in', () => {
    const providing = (approval: ApprovalNeeded | null) =>
      ProvidedTool.of({
        integration: IntegrationKey.of('linear'),
        name: 'comment',
        description: 'Comment on the issue.',
        inputs: [input({ name: 'intent' })],
        backing: ToolBacking.action('comment'),
        approval,
      });

    expect(() =>
      providing(
        ApprovalNeeded.of({ because: 'It posts publicly.' }, 'linear.comment'),
      ),
    ).toThrow(/cannot take reserved input/);
    expect(providing(null).inputs.map((each) => each.name)).toEqual(['intent']);
  });

  it('rejects more than one stdin input, or one that is not text', () => {
    expect(() =>
      provided([
        input({ name: 'one', stdin: true }),
        input({ name: 'two', stdin: true }),
      ]),
    ).toThrow(InvalidIntegrationError);
    expect(() =>
      provided([input({ schema: InputSchema.ofType('number'), stdin: true })]),
    ).toThrow(InvalidIntegrationError);
  });
});
