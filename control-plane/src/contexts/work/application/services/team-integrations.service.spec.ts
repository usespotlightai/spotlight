import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const LINEAR: ToolDeclaration = {
  tool: 'linear.comment',
  integrationName: 'Linear',
  description: 'Comment on the issue.',
  inputs: [],
  approval: null,
  inferredOutput: null,
};

const nothing = async () => [];

describe('TeamIntegrations', () => {
  it('offers what the line’s team’s integrations offer, in Work’s own terms', async () => {
    const provided = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({
      provided,
      toolsOnMarks: nothing,
    });

    const tools = await service.provided({ teamId: TEAM } as LineMap, [
      Tool.of('linear.comment'),
      Tool.of('pull-request'),
    ]);

    expect(tools.map((each) => each.tool.value)).toEqual(['linear.comment']);
    expect(tools[0]?.description).toBe('Comment on the issue.');
    expect(tools[0]?.providedBy).toBe('Linear');
    expect(provided).toHaveBeenCalledWith(TEAM, ['linear.comment']);
  });

  it('carries what a tool answered before', async () => {
    const inferredOutput = { type: 'string' };
    const service = new TeamIntegrations({
      provided: vi.fn(async () => [{ ...LINEAR, inferredOutput }]),
      toolsOnMarks: nothing,
    });

    const [tool] = await service.provided({ teamId: TEAM } as LineMap, [
      Tool.of('linear.comment'),
    ]);

    expect(tool?.inferredOutput).toEqual(inferredOutput);
  });

  it('requests nothing from the integrations when no enabled tool comes from one', async () => {
    const provided = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({
      provided,
      toolsOnMarks: nothing,
    });

    expect(
      await service.provided({ teamId: TEAM } as LineMap, [
        Tool.of('pull-request'),
      ]),
    ).toEqual([]);
    expect(provided).not.toHaveBeenCalled();
  });

  it('enables each tool an integration enables on a mark the task carries', async () => {
    const toolsOnMarks = vi.fn(async () => ['sentry.get-issue']);
    const service = new TeamIntegrations({
      provided: nothing,
      toolsOnMarks,
    });

    const tools = await service.toolsOnMarks({ teamId: TEAM } as LineMap, [
      Mark.of('sentry.issue', '4507'),
      Mark.of('sentry.issue', '4508'),
      Mark.of('sentry.link', 'https://sentry.io/issues/4507/'),
    ]);

    expect(tools.map((each) => each.value)).toEqual(['sentry.get-issue']);
    expect(toolsOnMarks).toHaveBeenCalledWith(TEAM, [
      'sentry.issue',
      'sentry.issue',
      'sentry.link',
    ]);
  });

  it('asks the integrations nothing for a task without marks', async () => {
    const toolsOnMarks = vi.fn(async () => ['sentry.get-issue']);
    const service = new TeamIntegrations({
      provided: nothing,
      toolsOnMarks,
    });

    expect(await service.toolsOnMarks({ teamId: TEAM } as LineMap, [])).toEqual(
      [],
    );
    expect(toolsOnMarks).not.toHaveBeenCalled();
  });
});
