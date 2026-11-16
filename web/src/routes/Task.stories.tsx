import type { Meta, StoryObj } from '@storybook/react-vite';

import { EDITOR_NAMES, type EditorApp } from '@/lib/editor';
import { MAYA, SAM } from '@/mocks/world/people';
import { takenOverBy } from '@/mocks/world/takeovers';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskArgs = {
  readonly task:
    | 'task_retries'
    | 'task_postgres'
    | 'task_search'
    | 'task_latency';
  readonly preferred: EditorApp;
  readonly editor: 'closed' | 'menu' | 'setup';
  readonly takeover: 'none' | 'taking' | 'taken' | 'yours' | 'giving-back';
};

const TEAM = 'team_platform';

const meta = {
  title: 'Team/Lines/Task',
  ...pageStory<TaskArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}`,
    args: {
      task: 'task_retries',
      preferred: 'vscode',
      editor: 'closed',
      takeover: 'none',
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
      takeover: choice('Takeover', {
        none: 'Not taken over',
        taking: 'Take over dialog',
        taken: 'Taken over by someone else',
        yours: 'Taken over by you',
        'giving-back': 'Give it back dialog',
      }),
    },
    world: ({ preferred, task, takeover }) => {
      try {
        localStorage.setItem('spotlight.editor-app', preferred);
      } catch {}
      if (takeover === 'taken') {
        takenOverBy(TEAM, task, MAYA);
      }
      if (takeover === 'yours' || takeover === 'giving-back') {
        takenOverBy(TEAM, task, SAM);
      }
    },
    script: ({ editor, preferred, takeover }) => {
      if (takeover === 'taking' || takeover === 'giving-back') {
        return async (screen, user) => {
          await screen.findByRole('button', { name: 'Task options' });
          await user.keyboard(
            takeover === 'taking' ? '{Shift>}T{/Shift}' : '{Shift>}H{/Shift}',
          );
          await screen.findByRole('dialog');
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

export const TakeOver: StoryObj<typeof meta> = {
  args: { takeover: 'taking' },
};

export const TakenOver: StoryObj<typeof meta> = {
  args: { takeover: 'taken' },
};

export const TakenOverByYou: StoryObj<typeof meta> = {
  args: { takeover: 'yours' },
};

export const GiveItBack: StoryObj<typeof meta> = {
  args: { takeover: 'giving-back' },
};
