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
  learnedOutput: null,
};

describe('TeamIntegrations', () => {
  it('offers what the line’s team’s integrations offer, in Work’s own terms', async () => {
    const offered = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({ offered });

    const tools = await service.offered({ teamId: TEAM } as Line, [
      Tool.of('linear.comment'),
      Tool.of('pull-request'),
    ]);

    expect(tools.map((each) => each.tool.value)).toEqual(['linear.comment']);
    expect(tools[0]?.description).toBe('Comment on the issue.');
    expect(tools[0]?.offeredBy).toBe('Linear');
    expect(offered).toHaveBeenCalledWith(TEAM, ['linear.comment']);
  });

  it('carries what a tool answered before', async () => {
    const learnedOutput = { type: 'string' };
    const service = new TeamIntegrations({
      offered: vi.fn(async () => [{ ...LINEAR, learnedOutput }]),
    });

    const [tool] = await service.offered({ teamId: TEAM } as Line, [
      Tool.of('linear.comment'),
    ]);

    expect(tool?.learnedOutput).toEqual(learnedOutput);
  });

  it('requests nothing from the integrations when no enabled tool comes from one', async () => {
    const offered = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({ offered });

    expect(
      await service.offered({ teamId: TEAM } as Line, [
        Tool.of('pull-request'),
      ]),
    ).toEqual([]);
    expect(offered).not.toHaveBeenCalled();
  });
});
