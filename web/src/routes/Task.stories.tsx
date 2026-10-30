import type { Meta, StoryObj } from '@storybook/react-vite';
import { EDITOR_NAMES, type EditorApp } from '@/lib/editor';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type TaskArgs = {
  readonly task: 'task_retries' | 'task_postgres' | 'task_search';
  readonly preferred: EditorApp;
  readonly editor: 'closed' | 'menu' | 'setup';
};

const meta = {
  title: 'Team/Lines/Task',
  ...pageStory<TaskArgs>({
    states: ['data', 'loading', 'error'],
    at: ({ task }) => `/w/acme/team/team_platform/tasks/${task}`,
    args: { task: 'task_retries', preferred: 'vscode', editor: 'closed' },
    argTypes: {
      task: choice('Task', {
        task_retries: 'Working',
        task_postgres: 'Waiting for you',
        task_search: 'Completed',
      }),
      preferred: choice('Editor chosen last', EDITOR_NAMES),
      editor: choice('Open in an editor', {
        closed: 'Closed',
        menu: 'Editor menu open',
        setup: 'The editor did not open',
      }),
    },
    world: ({ preferred }) => {
      try {
        localStorage.setItem('spotlight.editor-app', preferred);
      } catch {}
    },
    script: ({ editor, preferred }) => {
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
