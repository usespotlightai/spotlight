import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Tool } from '@work/domain/value-objects/tool.vo';
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

describe('TeamIntegrations', () => {
  it('offers what the line’s team’s integrations offer, in Work’s own terms', async () => {
    const provided = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({ provided: provided });

    const tools = await service.provided({ teamId: TEAM } as Line, [
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
    });

    const [tool] = await service.provided({ teamId: TEAM } as Line, [
      Tool.of('linear.comment'),
    ]);

    expect(tool?.inferredOutput).toEqual(inferredOutput);
  });

  it('requests nothing from the integrations when no enabled tool comes from one', async () => {
    const provided = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({ provided: provided });

    expect(
      await service.provided({ teamId: TEAM } as Line, [
        Tool.of('pull-request'),
      ]),
    ).toEqual([]);
    expect(provided).not.toHaveBeenCalled();
  });
});
