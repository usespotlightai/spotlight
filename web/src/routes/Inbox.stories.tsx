import type { Meta, StoryObj } from '@storybook/react-vite';
import { within } from 'storybook/test';

import { stateFor } from '@/lib/github';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ACCEPTED_DISAGREEMENT_REQUEST_ID,
  ALERT_REQUEST_ID,
  CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID,
  COST_ALERT_REQUEST_ID,
  DECIDED_MEMORIES_REQUEST_ID,
  LABEL_GONE_DISAGREEMENT_REQUEST_ID,
  MEMORIES_REQUEST_ID,
  MERGED_DISAGREEMENT_REQUEST_ID,
  SEARCH_DISAGREEMENT_REQUEST_ID,
  SENT_BACK_DISAGREEMENT_REQUEST_ID,
  SETUP_ITEM_ID,
  VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID,
} from '@/mocks/world/inbox';
import {
  answerDisputedClaims,
  type ClaimsAnswered,
} from '@/mocks/world/inbox-disagreements';
import { minutesAfter } from '@/mocks/world/inbox-places';
import { withCitationsGone } from '@/mocks/world/inbox-scores';
import { inboxStore } from '@/mocks/world/inbox-store';
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

  return about !== null && about !== ''
    ? inboxStore().disagreements[about]
    : undefined;
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
  SEARCH_DISAGREEMENT_REQUEST_ID,
  SENT_BACK_DISAGREEMENT_REQUEST_ID,
  ACCEPTED_DISAGREEMENT_REQUEST_ID,
  MERGED_DISAGREEMENT_REQUEST_ID,
];

type Configuration = 'not-started' | 'working' | 'done';

type Standing = 'seeded' | 'assignee' | 'team' | 'following';

type InboxArgs = {
  readonly opened: string;
  readonly gitHubInstalled: boolean;
  readonly hostConnected: boolean;
  readonly configuration: Configuration;
  readonly admin: boolean;
  readonly editingMemory: boolean;
  readonly approvingMemory: boolean;
  readonly restoringMemory: boolean;
  readonly answeringYes: boolean;
  readonly answeringDisagreement: boolean;
  readonly standing: Standing;
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
      restoringMemory: false,
      answeringYes: false,
      answeringDisagreement: false,
      standing: 'seeded',
      withdrawing: false,
      claimsAnswered: 'none',
      scoresLoading: false,
      citationsGone: false,
    },
    argTypes: {
      opened: choice('Open item', {
        none: 'None',
        'task_rate_limits:0': 'Waiting for review',
        'task_retry_after:0': 'Suggests closing the task',
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
        [SEARCH_DISAGREEMENT_REQUEST_ID]:
          'Disagreement on a merged pull request, one claim in dispute',
        [SENT_BACK_DISAGREEMENT_REQUEST_ID]: 'Disagreement on a sent-back run',
        [ACCEPTED_DISAGREEMENT_REQUEST_ID]: 'Disagreement on an accepted run',
        [MERGED_DISAGREEMENT_REQUEST_ID]:
          'Disagreement on a merged pull request, several claims in dispute',
        [VERDICTS_AGREE_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, verdicts agree',
        [CLAIMS_CHANGED_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, claims changed',
        [LABEL_GONE_DISAGREEMENT_REQUEST_ID]:
          'Disagreement withdrawn, people’s verdict gone',
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
      restoringMemory: toggle('Restore the rejected memory'),
      answeringYes: toggle('Answer Yes'),
      answeringDisagreement: {
        ...toggle('Answer the disagreement'),
        if: { arg: 'opened', neq: 'none' },
      },
      withdrawing: {
        ...toggle('Withdraw an open disagreement'),
        if: { arg: 'opened', neq: 'none' },
      },
      claimsAnswered: {
        ...choice<ClaimsAnswered>('Claims answered, on an open disagreement', {
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
      standing: choice<Standing>(
        'Viewer stands as, on an item other than a disagreement',
        {
          seeded: 'As seeded',
          assignee: 'Assignee',
          team: 'Team, nobody assigned',
          following: 'Follower',
        },
      ),
    },
    world: ({
      opened,
      gitHubInstalled,
      hostConnected,
      configuration,
      admin,
      standing,
      withdrawing,
      claimsAnswered,
      scoresLoading,
      citationsGone,
    }) => {
      const disagreement = disagreementOpened(opened);
      if (disagreement) {
        answerDisputedClaims(disagreement, claimsAnswered);
      }
      if (disagreement && withdrawing && disagreement.state !== 'withdrawn') {
        disagreement.state = 'withdrawn';
        disagreement.withdrawnAt = minutesAfter(
          disagreement.answers.at(-1)?.answeredAt ?? disagreement.openedAt,
          30,
        );
        disagreement.withdrawnBecause =
          disagreement.labelFrom === 'merged'
            ? 'verdicts-agree'
            : 'claims-changed';
      }
      if (disagreement && disagreement.state !== 'open') {
        for (const entry of inboxStore().entries) {
          if (entry.kind === 'task' && entry.id === opened) {
            entry.resolved = true;
          }
        }
      }
      inboxStore().scoresWait = scoresLoading;
      if (citationsGone) {
        const { scores } = inboxStore();
        for (const [runId, each] of Object.entries(scores)) {
          scores[runId] = withCitationsGone(each);
        }
      }

      if (standing !== 'seeded' && !disagreement) {
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
      restoringMemory,
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
      if (opened === DECIDED_MEMORIES_REQUEST_ID && restoringMemory) {
        return async (screen, user) => {
          await user.click(
            await screen.findByRole('button', { name: /^Restore memory / }),
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
              (button) =>
                !(button instanceof HTMLButtonElement && button.disabled),
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
          const notMet = screen.queryByRole('radio', {
            name: 'No claim covers it',
          });

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
          } else if (notMet) {
            await user.click(notMet);
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
