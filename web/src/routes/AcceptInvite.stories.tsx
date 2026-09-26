import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { mocked } from 'storybook/test';
import { useSession } from '@/hooks/api/useSession';
import { AcceptInvite } from '@/routes/AcceptInvite';
import {
  failInvite,
  missingInvite,
  seedInvite,
  TOKEN,
} from '@/stories/fixtures/invite';
import { StoryShell } from '@/stories/StoryShell';

const AT = `/invites/${TOKEN}`;

const routes = <Route path="/invites/:token" element={<AcceptInvite />} />;

const signedOut = () => {
  mocked(useSession).mockReturnValue({
    data: null,
    isPending: false,
    isRefetching: false,
    error: null,
    refetch: async () => undefined,
  } as never);

  return () => mocked(useSession).mockRestore();
};

const meta = {
  title: 'Auth/Accept invite',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const NotFound: Story = {
  render: () => (
    <StoryShell at={AT} seed={missingInvite}>
      {routes}
    </StoryShell>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryShell at={AT} seed={failInvite}>
      {routes}
    </StoryShell>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryShell at={AT} seed={seedInvite}>
      {routes}
    </StoryShell>
  ),
};

export const SignedOut: Story = {
  beforeEach: signedOut,
  render: () => (
    <StoryShell at={AT} seed={seedInvite}>
      {routes}
    </StoryShell>
  ),
};
