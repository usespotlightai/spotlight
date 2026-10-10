import { describe, expect, it } from 'vitest';
import { getWorkspace, listMemberWorkspaces, listTeamLines } from '@/lib/api';
import { setOpenPage } from '@/mocks/scenario';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';

describe('the mock shell', () => {
  serveMockApi();

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

describe('the mock shell in an error state', () => {
  serveMockApi('error');

  it('answers what only the shell reads, so just the open page fails', async () => {
    setOpenPage(`/w/${SLUG}/inbox`);

    const { response } = await listTeamLines({ path: { teamId: PLATFORM_ID } });

    expect(response?.status).toBe(200);
  });

  it('fails what the open page reads as its own, even where the shell reads it too', async () => {
    setOpenPage(`/w/${SLUG}/team/${PLATFORM_ID}/lines/line_delivery`);

    const { response } = await listTeamLines({ path: { teamId: PLATFORM_ID } });

    expect(response?.status).toBe(500);
  });
});
