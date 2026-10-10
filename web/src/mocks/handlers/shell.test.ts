import { describe, expect, it } from 'vitest';
import { getWorkspace, listMemberWorkspaces, listTeamLines } from '@/lib/api';
import { useMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';

describe('the mock shell', () => {
  useMockApi();

  it('answers the workspace, its teams and their lines', async () => {
    const { data: workspaces } = await listMemberWorkspaces({
      throwOnError: true,
    });
    const { data: workspace } = await getWorkspace({
      path: { slug: SLUG },
      throwOnError: true,
    });
    const { data: lines } = await listTeamLines({
      path: { teamId: PLATFORM_ID },
      throwOnError: true,
    });

    expect(workspaces.map((each) => each.slug)).toEqual([SLUG]);
    expect(workspace.teams.map((each) => each.name)).toEqual([
      'Platform',
      'Growth',
    ]);
    expect(lines.map((each) => each.name)).toEqual(['Delivery', 'Incidents']);
  });
});
