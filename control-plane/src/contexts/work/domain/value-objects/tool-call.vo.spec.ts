import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { describe, expect, it } from 'vitest';

const CALL = ToolCall.of(
  Tool.of('linear.issue-create'),
  ToolInputs.of({
    input: { title: 'Broken', labelIds: ['bug'] },
    first: 3,
    draft: false,
    teamId: 'ENG',
  }),
  {
    input: InputSchema.of({
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        labelIds: { type: 'array', items: { type: 'string' } },
      },
    }),
    first: InputSchema.ofType('integer'),
  },
);

describe('ToolCall', () => {
  it('shows its inputs, structured values as JSON', () => {
    expect(CALL.writtenInputs).toEqual([
      { name: 'draft', value: 'false' },
      { name: 'first', value: '3' },
      {
        name: 'input',
        value: '{\n  "title": "Broken",\n  "labelIds": [\n    "bug"\n  ]\n}',
      },
      { name: 'teamId', value: 'ENG' },
    ]);
  });

  it('takes an edit of a structured value as JSON of the same shape', () => {
    const edited = CALL.editedTo({
      input: '{"title": "Broken again"}',
      first: '4',
      draft: 'true',
      teamId: 'OPS',
    });

    expect('call' in edited && edited.call.inputs.values).toEqual({
      input: { title: 'Broken again' },
      first: 4,
      draft: true,
      teamId: 'OPS',
    });
  });

  it('rejects an edit a structured value cannot be read from', () => {
    const editing = (input: string) =>
      CALL.editedTo({ input, first: '3', draft: 'false', teamId: 'ENG' });

    expect(editing('{not json')).toEqual({ problem: null });
    expect(editing('["a list"]')).toEqual({ problem: null });
    expect(editing('')).toEqual({ problem: null });
  });

  it('rejects an edit the tool would not take, saying where and why', () => {
    expect(
      CALL.editedTo({
        input: '{"labelIds": ["bug", 3]}',
        first: '3',
        draft: 'false',
        teamId: 'ENG',
      }),
    ).toEqual({ problem: 'input needs title' });
    expect(
      CALL.editedTo({
        input: '{"title": "x", "labelIds": [3]}',
        first: '3',
        draft: 'false',
        teamId: 'ENG',
      }),
    ).toEqual({ problem: 'input.labelIds[0] is not text' });
  });

  it('keeps the input shapes through its parts', () => {
    const stored = ToolCall.rehydrate(CALL.parts);

    expect(
      stored.editedTo({
        input: '{}',
        first: '3',
        draft: 'false',
        teamId: 'ENG',
      }),
    ).toEqual({ problem: 'input needs title' });
  });

  it('is the same call whatever order its structured values were written in', () => {
    const reordered = ToolCall.of(
      Tool.of('linear.issue-create'),
      ToolInputs.of({
        teamId: 'ENG',
        draft: false,
        first: 3,
        input: { labelIds: ['bug'], title: 'Broken' },
      }),
    );

    expect(CALL.equals(reordered)).toBe(true);
    expect(
      CALL.equals(
        ToolCall.of(
          Tool.of('linear.issue-create'),
          ToolInputs.of({ ...CALL.inputs.values, input: { title: 'Other' } }),
        ),
      ),
    ).toBe(false);
  });
});
