import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { ApprovalNeeded } from '@integrations/domain/value-objects/approval-needed.vo';
import {
  OfferedTool,
  type OfferedToolInput,
} from '@integrations/domain/value-objects/offered-tool.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { describe, expect, it } from 'vitest';

const input = (over: Partial<OfferedToolInput> = {}): OfferedToolInput => ({
  name: 'body',
  type: 'string',
  description: null,
  required: true,
  defaulted: false,
  piped: false,
  ...over,
});

const offered = (
  inputs: readonly OfferedToolInput[],
  description = 'Comment on the issue.',
) =>
  OfferedTool.of({
    source: SourceKey.of('linear'),
    name: 'comment',
    description,
    inputs,
    does: 'comment',
  });

describe('OfferedTool', () => {
  it('is named for the integration offering it', () => {
    expect(offered([]).tool).toBe('linear.comment');
  });

  it('keeps what a tool is for, and what it takes', () => {
    const tool = offered([
      input({ name: 'issue', defaulted: true }),
      input({ piped: true }),
    ]);

    expect(tool.description).toBe('Comment on the issue.');
    expect(tool.inputs.map((each) => each.name)).toEqual(['issue', 'body']);
  });

  it('refuses a tool that does not say what it is for', () => {
    expect(() => offered([], '  ')).toThrow(InvalidIntegrationError);
  });

  it('refuses an input named twice, or named unlike a flag', () => {
    expect(() => offered([input(), input()])).toThrow(InvalidIntegrationError);
    expect(() => offered([input({ name: 'Body' })])).toThrow(
      InvalidIntegrationError,
    );
  });

  it('refuses a tool needing approval that takes intent, which the agent says what it wants to do in', () => {
    const offering = (approval: ApprovalNeeded | null) =>
      OfferedTool.of({
        source: SourceKey.of('linear'),
        name: 'comment',
        description: 'Comment on the issue.',
        inputs: [input({ name: 'intent' })],
        does: 'comment',
        approval,
      });

    expect(() =>
      offering(
        ApprovalNeeded.of({ because: 'It posts publicly.' }, 'linear.comment'),
      ),
    ).toThrow(/keeps for the agent/);
    expect(offering(null).inputs.map((each) => each.name)).toEqual(['intent']);
  });

  it('refuses more than one piped input, or one that is not text', () => {
    expect(() =>
      offered([
        input({ name: 'one', piped: true }),
        input({ name: 'two', piped: true }),
      ]),
    ).toThrow(InvalidIntegrationError);
    expect(() => offered([input({ type: 'number', piped: true })])).toThrow(
      InvalidIntegrationError,
    );
  });
});
