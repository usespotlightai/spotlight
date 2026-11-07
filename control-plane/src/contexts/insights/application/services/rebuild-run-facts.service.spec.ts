import type { RunFactsMaintenance } from '@insights/application/services/project-run-facts.service';
import {
  RebuildRunFacts,
  type RebuiltRunFacts,
} from '@insights/application/services/rebuild-run-facts.service';
import { describe, expect, it } from 'vitest';

const factsOf = (workspaces: readonly string[]) => {
  const rebuilt: string[] = [];
  const facts: RunFactsMaintenance = {
    repairEndedSince: async () => ({ checked: 0, repaired: [] }),
    rebuild: async (owner) => {
      rebuilt.push(
        owner.kind === 'team'
          ? `${owner.workspaceId.value} ${owner.teamId.value}`
          : owner.workspaceId.value,
      );
      return 2;
    },
    workspaces: async () => workspaces,
  };

  return { facts, rebuilt };
};

describe('RebuildRunFacts', () => {
  it('rebuilds every workspace that has runs or facts when none is named', async () => {
    const { facts, rebuilt } = factsOf(['ws_1', 'ws_2']);
    const reported: RebuiltRunFacts[] = [];

    await new RebuildRunFacts(facts).ofWorkspaces(null, (each) =>
      reported.push(each),
    );

    expect(rebuilt).toEqual(['ws_1', 'ws_2']);
    expect(reported).toEqual([
      { owner: 'workspace ws_1', rebuilt: 2 },
      { owner: 'workspace ws_2', rebuilt: 2 },
    ]);
  });

  it('rebuilds only the named team', async () => {
    const { facts, rebuilt } = factsOf(['ws_1']);

    expect(await new RebuildRunFacts(facts).ofTeam('ws_1', 'team_1')).toEqual({
      owner: 'team team_1',
      rebuilt: 2,
    });
    expect(rebuilt).toEqual(['ws_1 team_1']);
  });
});
