import type { Meta, StoryObj } from '@storybook/react-vite';
import { stateFor } from '@/lib/github';
import { inboxItemPath, inboxPath } from '@/lib/inbox';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import {
  ALERT_ASIDE_ID,
  CLAIMS_GRADE_ASIDE_ID,
  COST_ALERT_ASIDE_ID,
  DECIDED_MEMORIES_ASIDE_ID,
  FIVE_POINT_GRADE_ASIDE_ID,
  GRADE_ASIDE_ID,
  GRADED_ASIDE_ID,
  MEMORIES_ASIDE_ID,
  SETUP_ITEM_ID,
} from '@/mocks/world/inbox';
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

type InboxArgs = {
  readonly opened: string;
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
        [MEMORIES_ASIDE_ID]: 'Proposed memories',
        [DECIDED_MEMORIES_ASIDE_ID]: 'Memories decided',
        [COST_ALERT_ASIDE_ID]: 'Station alert',
        [ALERT_ASIDE_ID]: 'Alert resolved',
        [GRADE_ASIDE_ID]: 'Grade run',
        [FIVE_POINT_GRADE_ASIDE_ID]: 'Grade from 1 to 5',
        [CLAIMS_GRADE_ASIDE_ID]: 'Grade claim by claim',
        [GRADED_ASIDE_ID]: 'Graded',
        [SETUP_ITEM_ID]: 'Set up your team',
        [GITHUB_INSTALLED]: 'Setup with GitHub installed',
      }),
      editingMemory: toggle('Edit the first memory'),
      approvingMemory: toggle('Approve the first memory'),
      answeringYes: toggle('Answer Yes'),
    },
    script: ({ opened, editingMemory, approvingMemory, answeringYes }) => {
      if (opened === MEMORIES_ASIDE_ID && editingMemory) {
        return async (screen, user) => {
          await user.click(
            (await screen.findAllByRole('button', { name: /^Edit/ }))[0],
          );
        };
      }
      if (opened === MEMORIES_ASIDE_ID && approvingMemory) {
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
