import type { Meta, StoryObj } from '@storybook/react-vite';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { type PageArgs, pageStory, toggle } from '@/stories/application';

const INSTALLED = `/github/installed?installation_id=58213907&state=${encodeURIComponent(`${SLUG}:${PLATFORM_ID}`)}`;

type InstalledArgs = {
  readonly requested: boolean;
};

const meta = {
  title: 'Workspace/GitHub installed',
  ...pageStory<InstalledArgs>({
    at: ({ requested }) =>
      requested ? `${INSTALLED}&setup_action=request` : INSTALLED,
    args: { requested: false },
    argTypes: {
      requested: toggle('Requested by a member'),
    },
  }),
} satisfies Meta<PageArgs & InstalledArgs>;

export default meta;

export const GitHubInstalled: StoryObj<typeof meta> = {
  name: 'GitHub installed',
};
