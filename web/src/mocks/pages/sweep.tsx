import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { INSIGHTS_TABS } from '@/lib/insights';
import { serveMockApi } from '@/mocks/testing';
import { GROWTH_ID, PLATFORM_ID, SLUG, world } from '@/mocks/world';
import { teamChats } from '@/mocks/world/team-chats';
import { RUN_CHANGE_STACKS } from '@/mocks/world/work-changes';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

const EMPTY =
  /^(No [a-z’' ]+ (yet|match)|Nobody has|Nothing (here|to show|needs attention))|could not be loaded|couldn’t be loaded|not found|no longer here/i;

const workspace = `/w/${SLUG}`;

const teamPath = (teamId: string) => `${workspace}/team/${teamId}`;

const everyTeam = (pages: (teamId: string) => string[]): string[] =>
  [PLATFORM_ID, GROWTH_ID].flatMap(pages);

export const workspacePages = (): string[] => [
  `${workspace}/inbox`,
  `${workspace}/settings/account/emails`,
  `${workspace}/settings/general`,
  `${workspace}/settings/members`,
  `${workspace}/settings/runners`,
  `${workspace}/settings/api-access`,
  ...everyTeam((teamId) => [
    `${teamPath(teamId)}/memory`,
    `${workspace}/settings/team/${teamId}/general`,
    `${workspace}/settings/team/${teamId}/integrations`,
    `${workspace}/settings/team/${teamId}/skills`,
  ]),
];

export const agentPages = (): string[] =>
  everyTeam((teamId) => [
    `${teamPath(teamId)}/agent`,
    ...(teamChats()[teamId] ?? []).map(
      ({ chat }) => `${teamPath(teamId)}/agent/${chat.id}`,
    ),
  ]);

export const linePages = (): string[] =>
  everyTeam((teamId) =>
    (world().lines[teamId] ?? []).flatMap((line) => [
      `${teamPath(teamId)}/lines/${line.id}`,
      ...line.stations.map(
        (station) =>
          `${teamPath(teamId)}/lines/${line.id}/stations/${station.id}`,
      ),
    ]),
  );

export const taskPages = (): string[] =>
  everyTeam((teamId) =>
    (world().tasks[teamId] ?? []).flatMap((task) => [
      `${teamPath(teamId)}/tasks/${task.id}`,
      ...((world().runs[task.id] ?? []).length > 0
        ? [`${teamPath(teamId)}/tasks/${task.id}/trace`]
        : []),
    ]),
  );

export const runPages = (): string[] =>
  everyTeam((teamId) => [
    `${teamPath(teamId)}/runs`,
    ...(world().tasks[teamId] ?? []).flatMap((task) =>
      (world().runs[task.id] ?? []).flatMap((run) => [
        `${teamPath(teamId)}/runs/${run.id}`,
        ...(RUN_CHANGE_STACKS[run.id]
          ? [`${teamPath(teamId)}/runs/${run.id}/changes`]
          : []),
      ]),
    ),
  ]);

export const insightsPages = (): string[] =>
  everyTeam((teamId) =>
    INSIGHTS_TABS.map((tab) => `${teamPath(teamId)}/insights?tab=${tab.id}`),
  );

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

const emptyStates = (): string[] => [
  ...new Set(
    [...document.body.querySelectorAll<HTMLElement>('p, h2, h3, span, div')]
      .filter(
        (each) =>
          each.children.length === 0 &&
          !each.closest('nav, aside, [data-sidebar]'),
      )
      .map((each) => each.textContent ?? '')
      .filter((text) => EMPTY.test(text)),
  ),
];

export const sweepPages = (pages: readonly string[]) => {
  describe('every page with data', () => {
    serveMockApi();
    quietBrowser();

    it.each(pages)(
      '%s shows data, never an empty or missing state',
      async (page) => {
        render(<MockApplication at={page} />);
        await loaded();

        expect(emptyStates()).toEqual([]);
      },
      20_000,
    );
  });
};
