import type { Meta, StoryObj } from '@storybook/react-vite';

import { EDITOR_NAMES, type EditorApp } from '@/lib/editor';
import { world } from '@/mocks/world';
import { onHoldBy } from '@/mocks/world/holds';
import { MAYA, SAM } from '@/mocks/world/people';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskArgs = {
  readonly task:
    | 'task_retries'
    | 'task_postgres'
    | 'task_search'
    | 'task_latency';
  readonly preferred: EditorApp;
  readonly editor: 'closed' | 'menu' | 'setup';
  readonly hold: 'none' | 'taken' | 'yours';
  readonly sendBack: 'none' | 'menu' | 'dialog';
};

const TEAM = 'team_platform';

const finishedAtReview = (taskId: string) => {
  world().tasks[TEAM] = (world().tasks[TEAM] ?? []).map((each) =>
    each.id === taskId
      ? {
          ...each,
          awaitingReview: null,
          finished: true,
          sendsBackTo: [
            'station_triage',
            'station_spec',
            'station_implementation',
          ],
        }
      : each,
  );
};

const meta = {
  title: 'Team/Lines/Task',
  ...pageStory<TaskArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}`,
    args: {
      task: 'task_retries',
      preferred: 'vscode',
      editor: 'closed',
      hold: 'none',
      sendBack: 'none',
    },
    argTypes: {
      task: choice('Task', {
        task_retries: 'Working',
        task_postgres: 'Waiting for you',
        task_search: 'Completed',
        task_latency: 'From an integration',
      }),
      preferred: choice('Editor chosen last', EDITOR_NAMES),
      editor: choice('Open in an editor', {
        closed: 'Closed',
        menu: 'Editor menu open',
        setup: 'The editor did not open',
      }),
      hold: choice('Hold', {
        none: 'Not on hold',
        taken: 'On hold by someone else',
        yours: 'On hold by you',
      }),
      sendBack: choice('Send a finished task back', {
        none: 'No',
        menu: 'Station menu open',
        dialog: 'Reason asked',
      }),
    },
    world: ({ preferred, task, hold, sendBack }) => {
      try {
        localStorage.setItem('spotlight.editor-app', preferred);
      } catch {}
      if (hold === 'taken') {
        onHoldBy(TEAM, task, MAYA);
      }
      if (hold === 'yours') {
        onHoldBy(TEAM, task, SAM);
      }
      if (sendBack !== 'none') {
        finishedAtReview(task);
      }
    },
    script: ({ editor, preferred, sendBack }) => {
      if (sendBack !== 'none') {
        return async (screen, user) => {
          await user.click(
            await screen.findByRole('button', { name: 'Station' }),
          );
          const implementation = await screen.findByRole('menuitemradio', {
            name: 'Implementation',
          });
          if (sendBack === 'dialog') {
            await user.click(implementation);
            await screen.findByRole('dialog');
          }
        };
      }
      if (editor === 'menu') {
        return async (screen, user) => {
          await user.click(
            await screen.findByRole('button', { name: 'Choose the editor' }),
          );
          await screen.findAllByRole('menuitem');
        };
      }
      if (editor === 'setup') {
        return async (screen, user) => {
          const stayOnPage = (event: MouseEvent) => event.preventDefault();
          document.addEventListener('click', stayOnPage);
          await user.click(
            await screen.findByRole('link', {
              name: `Open in ${EDITOR_NAMES[preferred]}`,
            }),
          );
          document.removeEventListener('click', stayOnPage);
          await screen.findByText(
            'Set up this computer once',
            {},
            { timeout: 5_000 },
          );
        };
      }
      return undefined;
    },
  }),
} satisfies Meta<PageArgs & TaskArgs>;

export default meta;

export const Task: StoryObj<typeof meta> = {};

export const EditorMenu: StoryObj<typeof meta> = {
  args: { editor: 'menu' },
};

export const EditorSetup: StoryObj<typeof meta> = {
  args: { task: 'task_search', editor: 'setup' },
};

export const FromAnIntegration: StoryObj<typeof meta> = {
  args: { task: 'task_latency' },
};

export const SendBack: StoryObj<typeof meta> = {
  args: { task: 'task_postgres', sendBack: 'dialog' },
};

export const Held: StoryObj<typeof meta> = {
  args: { hold: 'taken' },
};

export const HeldByYou: StoryObj<typeof meta> = {
  args: { hold: 'yours' },
};
