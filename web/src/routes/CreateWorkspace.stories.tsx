import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { CreateWorkspace } from '@/routes/CreateWorkspace';
import { failMutations } from '@/stories/failMutations';
import { StoryShell } from '@/stories/StoryShell';

const AT = '/workspaces/new';

const routes = <Route path={AT} element={<CreateWorkspace />} />;

const meta = {
  title: 'Workspace/Create workspace',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StoryShell at={AT}>{routes}</StoryShell>,
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at={AT} seed={failMutations}>
      {routes}
    </StoryShell>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(canvas.getByPlaceholderText('Workspace name'), 'Acme');
    await userEvent.click(canvas.getByRole('button', { name: 'Continue' }));
    await userEvent.type(canvas.getByPlaceholderText('Product'), 'Platform');
    await userEvent.click(
      canvas.getByRole('button', { name: 'Create workspace' }),
    );
  },
};
