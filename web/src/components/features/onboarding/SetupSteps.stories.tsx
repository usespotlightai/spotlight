import type { Meta, StoryObj } from '@storybook/react-vite';
import type { QueryClient } from '@tanstack/react-query';
import { Route } from 'react-router';
import { SetupSteps } from '@/components/features/onboarding/SetupSteps';
import {
  BODY,
  failSetup,
  SETUP_ITEM_ID,
  SLUG,
  seedFreshSetup,
  seedGitHubInstalled,
  seedSetupDone,
  TEAM_ID,
} from '@/stories/fixtures/onboarding';
import { StoryShell } from '@/stories/StoryShell';

const at = `/w/${SLUG}/inbox/${SETUP_ITEM_ID}`;

const ABOUT = {
  title: 'Set up your team',
  description:
    'A few quick steps will get everything ready for your team to start working with Spotlight.',
};

function Showing({
  seed,
  resolved = false,
}: {
  seed?: (client: QueryClient) => void;
  resolved?: boolean;
}) {
  return (
    <StoryShell at={at} seed={seed}>
      <Route
        path="/w/:slug/inbox/:itemId"
        element={
          <div className="mx-auto max-w-xl p-6">
            <SetupSteps
              teamId={TEAM_ID}
              body={BODY}
              about={ABOUT}
              resolved={resolved}
            />
          </div>
        }
      />
    </StoryShell>
  );
}

const meta = {
  title: 'Onboarding/Setup steps',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  render: () => <Showing />,
};

export const Failed: Story = {
  name: 'Error',
  render: () => <Showing seed={failSetup} />,
};

export const Fresh: Story = {
  render: () => <Showing seed={seedFreshSetup} />,
};

export const GitHubInstalled: Story = {
  name: 'GitHub installed',
  render: () => <Showing seed={seedGitHubInstalled} />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole('button', { name: /Install the GitHub App/ }),
    );
  },
};

export const Done: Story = {
  render: () => <Showing seed={seedSetupDone} resolved />,
};
