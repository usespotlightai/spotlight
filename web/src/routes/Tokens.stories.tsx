import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { within } from 'storybook/test';
import { tokensPath } from '@/lib/token';
import { Tokens } from '@/routes/Tokens';
import { failMutations } from '@/stories/failMutations';
import {
  createSucceeds,
  emptyTokens,
  failTokens,
  SLUG,
  seedTokens,
} from '@/stories/fixtures/tokens';
import { StoryPage } from '@/stories/StoryPage';

const routes = <Route path="/w/:slug/settings/tokens" element={<Tokens />} />;

const meta = {
  title: 'Settings/Workspace/Tokens',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const createTerraformToken: NonNullable<Story['play']> = async ({
  canvas,
  canvasElement,
  userEvent,
}) => {
  await userEvent.click(
    await canvas.findByRole('button', { name: 'Create a token' }),
  );

  await userEvent.type(
    await within(canvasElement.ownerDocument.body).findByRole('textbox', {
      name: 'Name',
    }),
    'terraform',
  );
  await userEvent.keyboard('{Enter}');
};

export const Loading: Story = {
  render: () => <StoryPage at={tokensPath(SLUG)}>{routes}</StoryPage>,
};

export const Empty: Story = {
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={emptyTokens}>
      {routes}
    </StoryPage>
  ),
};

export const Failed: Story = {
  name: 'Error',
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={failTokens}>
      {routes}
    </StoryPage>
  ),
};

export const WithData: Story = {
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={seedTokens}>
      {routes}
    </StoryPage>
  ),
};

export const Creating: Story = {
  name: 'Creating a token',
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={seedTokens}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Create a token' }),
    );
  },
};

export const CouldNotCreate: Story = {
  name: 'Could not create a token',
  render: () => (
    <StoryPage
      at={tokensPath(SLUG)}
      seed={(client) => {
        seedTokens(client);
        failMutations(client);
      }}
    >
      {routes}
    </StoryPage>
  ),
  play: createTerraformToken,
};

export const TokenCreated: Story = {
  name: 'Token created',
  beforeEach: createSucceeds,
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={seedTokens}>
      {routes}
    </StoryPage>
  ),
  play: async (context) => {
    await createTerraformToken(context);

    await context.canvas.findByText('Copy the terraform token now');
  },
};

export const Revoking: Story = {
  name: 'Revoking a token',
  render: () => (
    <StoryPage at={tokensPath(SLUG)} seed={seedTokens}>
      {routes}
    </StoryPage>
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    (
      await canvas.findByRole('button', { name: 'Actions for terraform' })
    ).focus();
    await userEvent.keyboard('{Enter}');

    await userEvent.click(
      await within(canvasElement.ownerDocument.body).findByRole('menuitem', {
        name: 'Revoke token',
      }),
    );
  },
};
