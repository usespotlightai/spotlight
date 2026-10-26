import type { Meta, StoryObj } from '@storybook/react-vite';
import { stateFor } from '@/lib/github';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ALERT_REQUEST_ID,
  CLAIMS_GRADE_REQUEST_ID,
  COST_ALERT_REQUEST_ID,
  DECIDED_MEMORIES_REQUEST_ID,
  FIVE_POINT_GRADE_REQUEST_ID,
  GRADE_REQUEST_ID,
  GRADED_REQUEST_ID,
  MEMORIES_REQUEST_ID,
  SETUP_ITEM_ID,
} from '@/mocks/world/inbox';
import { SETUP_CI, settingsWorld } from '@/mocks/world/settings';
import { NO_FLEET } from '@/mocks/world/settings-runners';
import { teamChats } from '@/mocks/world/team-chats';
import {
  choice,
  type PageArgs,
  pageStory,
  toggle,
} from '@/stories/application';

const GITHUB_INSTALLED = 'github-installed';

const GITHUB_INSTALLED_PATH = `/github/installed?installation_id=58213907&state=${encodeURIComponent(
  stateFor({
    slug: SLUG,
    teamId: PLATFORM_ID,
    from: inboxItemPath(SLUG, SETUP_ITEM_ID),
  }),
)}`;

const SETTING_UP = { arg: 'opened', eq: SETUP_ITEM_ID };

type Configuration = 'not-started' | 'working' | 'done';

type GitHubActions = 'written' | 'not-permitted' | 'unprotected';

type InboxArgs = {
  readonly opened: string;
  readonly gitHubInstalled: boolean;
  readonly hostConnected: boolean;
  readonly configuration: Configuration;
  readonly admin: boolean;
  readonly gitHubActions: GitHubActions;
  readonly editingMemory: boolean;
  readonly approvingMemory: boolean;
  readonly answeringYes: boolean;
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
      gitHubActions: 'written',
      editingMemory: false,
      approvingMemory: false,
      answeringYes: false,
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
        [GRADE_REQUEST_ID]: 'Grade run',
        [FIVE_POINT_GRADE_REQUEST_ID]: 'Grade from 1 to 5',
        [CLAIMS_GRADE_REQUEST_ID]: 'Grade claim by claim',
        [GRADED_REQUEST_ID]: 'Graded',
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
      gitHubActions: {
        ...choice<GitHubActions>('GitHub Actions', {
          written: 'Variables written',
          'not-permitted': 'Variables not permitted',
          unprotected: 'Default branch unprotected',
        }),
        if: SETTING_UP,
      },
      editingMemory: toggle('Edit the first memory'),
      approvingMemory: toggle('Approve the first memory'),
      answeringYes: toggle('Answer Yes'),
    },
    world: ({
      opened,
      gitHubInstalled,
      hostConnected,
      configuration,
      admin,
      gitHubActions,
    }) => {
      if (opened !== SETUP_ITEM_ID) return;

      const settings = settingsWorld();
      settings.gitHubConnected = gitHubInstalled;
      settings.viewerIsAdmin = admin;
      settings.setupCi = {
        ...SETUP_CI,
        variables:
          gitHubActions === 'not-permitted' ? 'not-permitted' : 'written',
        defaultBranchProtected: gitHubActions !== 'unprotected',
      };
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
    script: ({ opened, editingMemory, approvingMemory, answeringYes }) => {
      if (opened === MEMORIES_REQUEST_ID && editingMemory) {
        return async (screen, user) => {
          await user.click(
            (await screen.findAllByRole('button', { name: /^Edit/ }))[0],
          );
        };
      }
      if (opened === MEMORIES_REQUEST_ID && approvingMemory) {
        return async (screen, user) => {
          await user.click(
            (
              await screen.findAllByRole('button', {
                name: /^Approve memory /,
              })
            )[0],
          );
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
