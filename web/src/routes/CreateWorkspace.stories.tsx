import type { Meta, StoryObj } from '@storybook/react-vite';
import { type PageArgs, pageStory, toggle } from '@/stories/application';

type CreateWorkspaceArgs = {
  readonly creating: boolean;
};

const meta = {
  title: 'Workspace/Create workspace',
  ...pageStory<CreateWorkspaceArgs>({
    states: ['data'],
    at: '/workspaces/new',
    args: { account: 'no-workspace', creating: false },
    argTypes: {
      creating: toggle('Create the workspace'),
    },
    script: ({ creating }) =>
      creating
        ? async (screen, user) => {
            await user.type(
              await screen.findByPlaceholderText('Workspace name'),
              'Acme',
            );
            await user.click(screen.getByRole('button', { name: 'Continue' }));
            await user.type(
              await screen.findByPlaceholderText('Product'),
              'Platform',
            );
            await user.click(
              await screen.findByRole('button', { name: 'Create workspace' }),
            );
          }
        : undefined,
  }),
} satisfies Meta<PageArgs & CreateWorkspaceArgs>;

export default meta;

export const CreateWorkspace: StoryObj<typeof meta> = {
  name: 'Create workspace',
};
