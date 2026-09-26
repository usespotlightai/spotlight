import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { Login } from '@/routes/Login';
import { failMutations } from '@/stories/failMutations';
import { StoryShell } from '@/stories/StoryShell';

const routes = <Route path="/login" element={<Login />} />;

const meta = {
  title: 'Auth/Log in',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <StoryShell at="/login">{routes}</StoryShell>,
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at="/login" seed={failMutations}>
      {routes}
    </StoryShell>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: 'Continue with GitHub' }),
    );
  },
};
