import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const LINEAR: ToolDeclaration = {
  tool: 'linear.comment',
  description: 'Comment on the issue.',
  inputs: [],
  approval: null,
};

describe('TeamIntegrations', () => {
  it('offers what the line’s team’s integrations offer, in Work’s own terms', async () => {
    const offered = vi.fn(async () => [LINEAR]);
    const service = new TeamIntegrations({
      offered,
      listening: async () => [],
    });

    const tools = await service.offered({ teamId: TEAM } as Line);

    expect(tools.map((each) => each.tool.value)).toEqual(['linear.comment']);
    expect(tools[0]?.description).toBe('Comment on the issue.');
    expect(offered).toHaveBeenCalledWith(TEAM);
  });
});
