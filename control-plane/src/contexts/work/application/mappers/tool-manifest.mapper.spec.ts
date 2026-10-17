import { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';
import { toolManifestOf } from '@work/application/mappers/tool-manifest.mapper';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const BODY = {
  name: 'body',
  schema: InputSchema.ofType('string'),
  description: null,
  required: true,
  defaulted: false,
  piped: false,
};

const tool = (
  approval: ApprovalNeeded | null,
  offeredBy: string | null = null,
) =>
  DeclaredTool.of({
    tool: Tool.of('linear.comment'),
    description: 'Comment on the issue.',
    inputs: [BODY],
    approval,
    offeredBy,
  });

describe('toolManifestOf', () => {
  it('tells the agent to say what it wants to do, where a person approves the call', () => {
    const manifest = toolManifestOf(
      tool(ApprovalNeeded.of('linear.comment', 'It posts publicly.')),
    );

    expect(manifest.inputs.map((each) => each.name)).toEqual([
      'body',
      'intent',
    ]);
    expect(manifest.inputs[1]?.required).toBe(false);
    expect(manifest.description).toContain('--intent');
  });

  it('says why a person approves the call, apart from what the tool does', () => {
    const manifest = toolManifestOf(
      tool(ApprovalNeeded.of('linear.comment', 'It posts publicly.')),
    );

    expect(manifest.approval).toEqual({ because: 'It posts publicly.' });
    expect(manifest.description).toContain('It posts publicly.');
  });

  it('says what the tool answered before', () => {
    const learnedOutput = { type: 'string' };
    const learned = DeclaredTool.of({
      tool: Tool.of('linear.comment'),
      description: 'Comment on the issue.',
      learnedOutput,
    });

    expect(toolManifestOf(learned).output).toEqual(learnedOutput);
    expect(toolManifestOf(tool(null))).not.toHaveProperty('output');
  });

  it('names the integration the tool comes from', () => {
    expect(toolManifestOf(tool(null, 'Linear')).integration).toBe('Linear');
    expect(toolManifestOf(tool(null))).not.toHaveProperty('integration');
  });

  it('requires nothing more of a tool nobody approves', () => {
    const manifest = toolManifestOf(tool(null));

    expect(manifest.inputs.map((each) => each.name)).toEqual(['body']);
    expect(manifest.description).toBe('Comment on the issue.');
    expect(manifest.approval).toBeNull();
  });
});
