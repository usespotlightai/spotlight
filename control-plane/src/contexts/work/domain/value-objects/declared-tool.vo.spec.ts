import { InvalidToolError } from '@work/domain/exceptions/invalid-tool.error';
import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import {
  DeclaredTool,
  type ToolInput,
} from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const input = (over: Partial<ToolInput> = {}): ToolInput => ({
  name: 'body',
  type: 'string',
  description: null,
  required: true,
  defaulted: false,
  piped: false,
  ...over,
});

const declared = (
  inputs: readonly ToolInput[],
  description = 'Comment on the issue.',
) => DeclaredTool.of({ tool: Tool.of('linear.comment'), description, inputs });

describe('DeclaredTool', () => {
  it('keeps what a tool is for, and what it takes', () => {
    const tool = declared([
      input({ name: 'issue', defaulted: true }),
      input({ piped: true }),
    ]);

    expect(tool.description).toBe('Comment on the issue.');
    expect(tool.inputs.map((each) => each.name)).toEqual(['issue', 'body']);
  });

  it('refuses a tool that does not say what it is for', () => {
    expect(() => declared([], '  ')).toThrow(InvalidToolError);
  });

  it('refuses an input named twice, or named unlike a flag', () => {
    expect(() => declared([input(), input()])).toThrow(/takes one input twice/);
    expect(() => declared([input({ name: 'Body' })])).toThrow(/dashes/);
  });

  it('refuses more than one piped input, and one that is not text', () => {
    expect(() =>
      declared([input({ piped: true }), input({ name: 'note', piped: true })]),
    ).toThrow(/more than one input piped in/);
    expect(() => declared([input({ type: 'number', piped: true })])).toThrow(
      /text/,
    );
  });

  describe('what the agent says it wants to do', () => {
    const approving = (inputs: readonly ToolInput[] = [input()]) =>
      DeclaredTool.of({
        tool: Tool.of('linear.comment'),
        description: 'Comment on the issue.',
        inputs,
        approval: ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
      });

    it('takes it apart from what the tool takes, where a person approves the call', () => {
      const { intent, rest } = approving().intentIn({
        body: 'Fixed.',
        intent: 'post the fix on ENG-12',
      });

      expect(intent?.value).toBe('post the fix on ENG-12');
      expect(rest).toEqual({ body: 'Fixed.' });
    });

    it('leaves it to be refused like any input, where nobody approves the call', () => {
      const { intent, rest } = declared([input()]).intentIn({
        body: 'Fixed.',
        intent: 'post it',
      });

      expect(intent).toBeNull();
      expect(rest).toEqual({ body: 'Fixed.', intent: 'post it' });
    });

    it('refuses a tool needing approval that takes an input of that name', () => {
      expect(() => approving([input({ name: 'intent' })])).toThrow(
        /keeps for the agent/,
      );
    });
  });

  describe('what it accepts from an agent', () => {
    const commenting = declared([
      input({ name: 'issue', defaulted: true }),
      input({ piped: true }),
      input({ name: 'count', type: 'number', required: false }),
      input({ name: 'urgent', type: 'boolean', required: false }),
    ]);

    it('takes what it takes, as the type it takes it as', () => {
      expect(
        commenting.accept(
          { issue: 'ENG-1', body: 'Fixed.', count: '3', urgent: 'true' },
          () => undefined,
        ).values,
      ).toEqual({ issue: 'ENG-1', body: 'Fixed.', count: 3, urgent: true });
    });

    it('reads an input left out from where it defaults to', () => {
      expect(
        commenting.accept({ body: 'Fixed.' }, (each) =>
          each.name === 'issue' ? 'ENG-2' : undefined,
        ).values,
      ).toEqual({ issue: 'ENG-2', body: 'Fixed.' });
    });

    it('refuses an input it does not take, saying what it does', () => {
      expect(() => commenting.accept({ body: 'x', isue: 'ENG-1' })).toThrow(
        'linear.comment takes no isue; it takes issue, body, count, urgent',
      );
    });

    it('refuses to go without an input it needs, counting blank as left out', () => {
      expect(() => commenting.accept({ issue: 'ENG-1' })).toThrow(
        InvalidToolInputError,
      );
      expect(() => commenting.accept({ issue: 'ENG-1', body: '   ' })).toThrow(
        'linear.comment needs body',
      );
      expect(() => commenting.accept({ body: 'x' })).toThrow(
        'needs issue, and this task has nothing to read it from',
      );
    });

    it('refuses an input that is not the type it takes', () => {
      expect(() =>
        commenting.accept({ issue: 'ENG-1', body: 'x', count: 'many' }),
      ).toThrow('takes count as a number, and "many" is not one');
    });
  });
});
