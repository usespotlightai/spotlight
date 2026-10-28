import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { INSIGHTS_TABS } from '@/lib/insights';
import { serveMockApi } from '@/mocks/testing';
import { GROWTH_ID, PLATFORM_ID, SLUG, world } from '@/mocks/world';
import { replayStore } from '@/mocks/world/station-replays';
import { searchStore } from '@/mocks/world/station-searches';
import { setStore } from '@/mocks/world/station-sets';
import { teamChats } from '@/mocks/world/team-chats';
import { RUN_CHANGE_STACKS } from '@/mocks/world/work-changes';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const EMPTY =
  /^(No [a-z’' ]+ (yet|match)|Nobody has|Nothing (here|to show|needs attention))|could not be loaded|couldn’t be loaded|not found|no longer here/i;

const workspace = `/w/${SLUG}`;

const teamPages = (teamId: string): string[] => {
  const team = `${workspace}/team/${teamId}`;
  const lines = world().lines[teamId] ?? [];
  const tasks = world().tasks[teamId] ?? [];
  const station = (lineId: string, stationId: string) =>
    `${team}/lines/${lineId}/stations/${stationId}`;
  const onTeam = (lineId: string) => lines.some((line) => line.id === lineId);
  const stationOfSet = (setId: string) => {
    const set = setStore().find((each) => each.id === setId);
    return set && onTeam(set.lineId)
      ? station(set.lineId, set.stationId)
      : null;
  };

  return [
    `${team}/agent`,
    ...(teamChats()[teamId] ?? []).map(
      ({ chat }) => `${team}/agent/${chat.id}`,
    ),
    ...lines.flatMap((line) => [
      `${team}/lines/${line.id}`,
      ...line.stations.flatMap((each) => [
        station(line.id, each.id),
        `${station(line.id, each.id)}/improve`,
      ]),
    ]),
    ...setStore()
      .filter((set) => onTeam(set.lineId))
      .map(
        (set) => `${station(set.lineId, set.stationId)}/replay-sets/${set.id}`,
      ),
    ...replayStore().flatMap((replay) => {
      const at = stationOfSet(replay.setId);
      return at ? [`${at}/replays/${replay.id}`] : [];
    }),
    ...searchStore().flatMap((search) => {
      const at = stationOfSet(search.setId);
      return at ? [`${at}/searches/${search.id}`] : [];
    }),
    ...tasks.flatMap((task) => [
      `${team}/tasks/${task.id}`,
      ...((world().runs[task.id] ?? []).length > 0
        ? [`${team}/tasks/${task.id}/trace`]
        : []),
    ]),
    `${team}/runs`,
    ...tasks.flatMap((task) =>
      (world().runs[task.id] ?? []).flatMap((run) => [
        `${team}/runs/${run.id}`,
        ...(RUN_CHANGE_STACKS[run.id]
          ? [`${team}/runs/${run.id}/changes`]
          : []),
      ]),
    ),
    ...INSIGHTS_TABS.map((tab) => `${team}/insights?tab=${tab.id}`),
    `${team}/memory`,
    `${workspace}/settings/team/${teamId}/general`,
    `${workspace}/settings/team/${teamId}/integrations`,
    `${workspace}/settings/team/${teamId}/skills`,
  ];
};

const PAGES = (): string[] => [
  `${workspace}/inbox`,
  `${workspace}/settings/general`,
  `${workspace}/settings/members`,
  `${workspace}/settings/runners`,
  `${workspace}/settings/api-access`,
  ...teamPages(PLATFORM_ID),
  ...teamPages(GROWTH_ID),
];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const loadingShown = () =>
  document.querySelectorAll('[role="status"], [data-slot="skeleton"]').length >
  0;

const loaded = async () => {
  let quiet = 0;
  for (let waited = 0; waited < 5000 && quiet < 3; waited += 100) {
    await pause(100);
    quiet = loadingShown() ? 0 : quiet + 1;
  }
};

describe('every page with data', () => {
  serveMockApi();
  quietBrowser();

  it('shows data, never an empty or missing state', async () => {
    const empty: string[] = [];

    for (const page of PAGES()) {
      const { unmount } = render(<MockApplication at={page} />);
      await loaded();
      const found = [
        ...document.body.querySelectorAll<HTMLElement>('p, h2, h3, span, div'),
      ]
        .filter(
          (each) =>
            each.children.length === 0 &&
            !each.closest('nav, aside, [data-sidebar]'),
        )
        .map((each) => each.textContent ?? '')
        .filter((text) => EMPTY.test(text));
      if (found.length > 0) {
        empty.push(`${page}: ${[...new Set(found)].join(' | ')}`);
      }
      unmount();
    }

    expect(empty).toEqual([]);
  }, 600_000);
});
