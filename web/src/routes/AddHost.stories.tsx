import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { addHostPath } from '@/lib/runner';
import { AddHost } from '@/routes/AddHost';
import { failMutations } from '@/stories/failMutations';
import { emptyRunners, SLUG } from '@/stories/fixtures/runners';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/settings/runners/new" element={<AddHost />} />
);

const meta = {
  title: 'Settings/Workspace/Runners/Add a host',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <StoryPage at={addHostPath(SLUG)} seed={emptyRunners}>
      {routes}
    </StoryPage>
  ),
};

export const CouldNotCreatePool: Story = {
  name: 'Could not create a pool',
  render: () => (
    <StoryPage
      at={addHostPath(SLUG)}
      seed={(client) => {
        emptyRunners(client);
        failMutations(client);
      }}
    >
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Create pool' }),
    );
  },
};
