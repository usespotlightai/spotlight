import type { Meta, StoryObj } from '@storybook/react-vite';
import { within } from 'storybook/test';

import { stateFor } from '@/lib/github';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ACCEPTED_DISAGREEMENT_REQUEST_ID,
  ALERT_REQUEST_ID,
  ASKED_OF_OTHER_DISAGREEMENT_REQUEST_ID,
  CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID,
  LABEL_GONE_DISAGREEMENT_REQUEST_ID,
  COST_ALERT_REQUEST_ID,
  DECIDED_MEMORIES_REQUEST_ID,
  FAILED_DISAGREEMENT_REQUEST_ID,
  MEMORIES_REQUEST_ID,
  MERGED_DISAGREEMENT_REQUEST_ID,
  PASSED_DISAGREEMENT_REQUEST_ID,
  SENT_BACK_DISAGREEMENT_REQUEST_ID,
  SETUP_ITEM_ID,
  WITHDRAWN_DISAGREEMENT_REQUEST_ID,
} from '@/mocks/world/inbox';
import {
  answerDisputedClaims,
  type ClaimsAnswered,
} from '@/mocks/world/inbox-disagreements';
import { withCitationsGone } from '@/mocks/world/inbox-scores';
import { inboxStore } from '@/mocks/world/inbox-store';
import { MAYA } from '@/mocks/world/people';
import { settingsWorld } from '@/mocks/world/settings';
import { NO_FLEET } from '@/mocks/world/settings-runners';
import { teamChats } from '@/mocks/world/team-chats';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

const GITHUB_INSTALLED = 'github-installed';

const disagreementOpened = (opened: string) => {
  const entry = inboxStore().entries.find((each) => each.id === opened);
  const about =
    entry &&
    'inboxRequest' in entry &&
    entry.inboxRequest?.form === 'judge-disagreement'
      ? entry.inboxRequest.about
      : null;

  return about ? inboxStore().disagreements[about] : undefined;
};

const GITHUB_INSTALLED_PATH = `/github/installed?installation_id=58213907&state=${encodeURIComponent(
  stateFor({
    slug: SLUG,
    teamId: PLATFORM_ID,
    from: inboxItemPath(SLUG, SETUP_ITEM_ID),
  }),
)}`;

const SETTING_UP = { arg: 'opened', eq: SETUP_ITEM_ID };

const DISAGREEMENTS_ANSWERED_BY_FORM = [
  FAILED_DISAGREEMENT_REQUEST_ID,
  PASSED_DISAGREEMENT_REQUEST_ID,
  SENT_BACK_DISAGREEMENT_REQUEST_ID,
  ACCEPTED_DISAGREEMENT_REQUEST_ID,
  MERGED_DISAGREEMENT_REQUEST_ID,
];

type Configuration = 'not-started' | 'working' | 'done';

type Standing = 'assignee' | 'team' | 'following';

type InboxArgs = {
  readonly opened: string;
  readonly gitHubInstalled: boolean;
  readonly hostConnected: boolean;
  readonly configuration: Configuration;
  readonly admin: boolean;
  readonly editingMemory: boolean;
  readonly approvingMemory: boolean;
  readonly answeringYes: boolean;
  readonly answeringDisagreement: boolean;
  readonly standing: Standing;
  readonly askedOfOther: boolean;
  readonly withdrawing: boolean;
  readonly claimsAnswered: ClaimsAnswered;
  readonly scoresLoading: boolean;
  readonly citationsGone: boolean;
};

const meta = {
  title: 'Inbox/Items',
  ...pageStory<InboxArgs>({
    at: ({ opened }) => {
      if (opened === 'none') return inboxPath(SLUG);
      if (opened === GITHUB_INSTALLED) return GITHUB_INSTALLED_PATH;

      return inboxItemPath(SLUG, opened);
    },
    args: {
      opened: 'none',
      gitHubInstalled: true,
      hostConnected: true,
      configuration: 'done',
      admin: true,
      editingMemory: false,
      approvingMemory: false,
      answeringYes: false,
      answeringDisagreement: false,
      standing: 'assignee',
      askedOfOther: false,
      withdrawing: false,
      claimsAnswered: 'none',
      scoresLoading: false,
      citationsGone: false,
    },
    argTypes: {
      opened: choice('Open item', {
        none: 'None',
        'task_rate_limits:0': 'Waiting for review',
        'task_latency:0': 'Awaiting approval',
        'task_signup_survey:0': 'A comment to post',
        'task_checkout:0': 'A command to run',
        'task_pricing_toggle:0': 'Asked of someone else',
        'task_referral:0': 'Approved with changes',
        'task_disk:0': 'Dismissed',
        'task_billing:0': 'Repeated failure',
        'task_retries:0': 'Answered',
        [MEMORIES_REQUEST_ID]: 'Proposed memories',
        [DECIDED_MEMORIES_REQUEST_ID]: 'Memories decided',
        [COST_ALERT_REQUEST_ID]: 'Station alert',
        [ALERT_REQUEST_ID]: 'Alert resolved',
        [FAILED_DISAGREEMENT_REQUEST_ID]: 'Disagreement, judge failed',
        [PASSED_DISAGREEMENT_REQUEST_ID]: 'Disagreement, judge passed',
        [SENT_BACK_DISAGREEMENT_REQUEST_ID]: 'Disagreement on a sent-back run',
        [ACCEPTED_DISAGREEMENT_REQUEST_ID]: 'Disagreement on an accepted run',
        [MERGED_DISAGREEMENT_REQUEST_ID]:
          'Disagreement on a merged pull request',
        [ASKED_OF_OTHER_DISAGREEMENT_REQUEST_ID]:
          'Disagreement asked of someone else',
        [WITHDRAWN_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, verdicts agree',
        [CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, claims changed',
        [LABEL_GONE_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, outcome gone',
        [SETUP_ITEM_ID]: 'Set up your team',
        [GITHUB_INSTALLED]: 'Setup with GitHub installed',
      }),
      gitHubInstalled: { ...toggle('GitHub App installed'), if: SETTING_UP },
      hostConnected: { ...toggle('Host connected'), if: SETTING_UP },
      configuration: {
        ...choice<Configuration>('Configuration as code', {
          'not-started': 'Not started',
          working: 'Setup chat working',
          done: 'Pull request opened',
        }),
        if: SETTING_UP,
      },
      admin: { ...toggle('Workspace owner or admin'), if: SETTING_UP },
      editingMemory: toggle('Edit the first memory'),
      approvingMemory: toggle('Approve the open memory'),
      answeringYes: toggle('Answer Yes'),
      answeringDisagreement: {
        ...toggle('Answer the disagreement'),
        if: { arg: 'opened', neq: 'none' },
      },
      askedOfOther: {
        ...toggle('Ask the disagreement of Maya Chen'),
        if: { arg: 'opened', neq: 'none' },
      },
      withdrawing: {
        ...toggle('Withdraw the disagreement'),
        if: { arg: 'opened', neq: 'none' },
      },
      claimsAnswered: {
        ...choice<ClaimsAnswered>('Claims in dispute answered', {
          none: 'None',
          first: 'The first',
          all: 'All, by two people on a team item',
        }),
        if: { arg: 'opened', neq: 'none' },
      },
      scoresLoading: {
        ...toggle('Run scores stay loading'),
        if: { arg: 'opened', neq: 'none' },
      },
      citationsGone: {
        ...toggle('Cited steps and files gone from the run'),
        if: { arg: 'opened', neq: 'none' },
      },
      standing: choice<Standing>('Viewer stands as', {
        assignee: 'Assignee',
        team: 'Team, nobody assigned',
        following: 'Follower',
      }),
    },
    world: ({
      opened,
      gitHubInstalled,
      hostConnected,
      configuration,
      admin,
      standing,
      askedOfOther,
      withdrawing,
      claimsAnswered,
      scoresLoading,
      citationsGone,
    }) => {
      const disagreement = disagreementOpened(opened);
      if (disagreement && askedOfOther) {
        disagreement.askedOf = MAYA.id;
      }
      if (disagreement) {
        answerDisputedClaims(disagreement, claimsAnswered);
      }
      if (disagreement?.state === 'answered') {
        for (const entry of inboxStore().entries) {
          if (entry.kind === 'task' && entry.id === opened) {
            entry.resolved = true;
          }
        }
      }
      if (disagreement && withdrawing) {
        disagreement.state = 'withdrawn';
        disagreement.withdrawnAt = disagreement.openedAt;
        disagreement.withdrawnBecause = 'verdicts-agree';
      }
      inboxStore().scoresWait = scoresLoading;
      if (citationsGone) {
        const { scores } = inboxStore();
        for (const [runId, each] of Object.entries(scores)) {
          scores[runId] = withCitationsGone(each);
        }
      }

      if (standing !== 'assignee') {
        for (const entry of inboxStore().entries) {
          if (entry.kind === 'task' && entry.id === opened) {
            entry.standing = standing;
          }
        }
      }

      if (opened !== SETUP_ITEM_ID) return;

      const settings = settingsWorld();
      settings.gitHubConnected = gitHubInstalled;
      settings.viewerIsAdmin = admin;
      if (!hostConnected) settings.fleet = structuredClone(NO_FLEET);

      const chats = teamChats()[PLATFORM_ID] ?? [];
      if (configuration === 'not-started') {
        teamChats()[PLATFORM_ID] = chats.filter(({ chat }) => !chat.setup);
      }
      if (configuration === 'working') {
        for (const { chat } of chats) {
          if (chat.setup) chat.setup.pullRequest = null;
        }
      }
    },
    script: ({
      opened,
      editingMemory,
      approvingMemory,
      answeringYes,
      answeringDisagreement,
    }) => {
      if (opened === MEMORIES_REQUEST_ID && editingMemory) {
        return async (screen, user) => {
          await user.click(
            (await screen.findAllByRole('button', { name: /^Edit/ }))[0],
          );
        };
      }
      if (opened === MEMORIES_REQUEST_ID && approvingMemory) {
        return async (screen, user) => {
          const approvable = await screen.findAllByRole('button', {
            name: /^Approve memory /,
          });
          await user.click(
            approvable.find(
              (button) => !(button as HTMLButtonElement).disabled,
            ) ?? approvable[0],
          );
        };
      }
      if (
        DISAGREEMENTS_ANSWERED_BY_FORM.includes(opened) &&
        answeringDisagreement
      ) {
        return async (screen, user) => {
          const cards = await screen
            .findAllByRole(
              'region',
              { name: /^Disagreement on claim / },
              { timeout: 10_000 },
            )
            .catch(() => []);
          const open = cards.find(
            (card) =>
              within(card).queryByRole('button', { name: 'Send answer' }) !==
              null,
          );

          if (open) {
            await user.click(
              within(open).getByRole('radio', {
                name: 'The claim does not fit this run',
              }),
            );
            await user.type(
              within(open).getByRole('textbox', { name: 'Why' }),
              'The spec asks for no load test.',
            );
            await user.click(
              within(open).getByRole('button', { name: 'Send answer' }),
            );
          } else {
            await user.click(
              await screen.findByRole('radio', { name: 'No claim covers it' }),
            );
            await user.type(
              screen.getByRole('textbox', { name: 'What was wrong' }),
              'It touched a file the spec did not name.',
            );
            await user.click(
              screen.getByRole('button', { name: 'Send answer' }),
            );
          }
        };
      }
      if (answeringYes) {
        return async (screen, user) => {
          await user.click(await screen.findByRole('button', { name: 'Yes' }));
        };
      }

      return undefined;
    },
  }),
} satisfies Meta<PageArgs & InboxArgs>;

export default meta;

export const Items: StoryObj<typeof meta> = {};
