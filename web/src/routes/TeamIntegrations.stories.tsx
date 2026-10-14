import type { Meta, StoryObj } from '@storybook/react-vite';
import { teamSettingsPath } from '@/lib/settings';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';

const OPENED = {
  none: 'None',
  Linear: 'Linear: team and your account',
  Sentry: 'Sentry: your account not connected',
  Honeycomb: 'Honeycomb: tools act as the team',
  PagerDuty: 'PagerDuty: receives events only',
  Statuspage: 'Statuspage: not connected, tools unreadable',
} as const;

type IntegrationsArgs = {
  readonly opened: keyof typeof OPENED;
};

const meta = {
  title: 'Settings/Team/Integrations',
  ...pageStory<IntegrationsArgs>({
    at: teamSettingsPath(SLUG, PLATFORM_ID, 'integrations'),
    args: { opened: 'none' },
    argTypes: { opened: choice('Opened integration', OPENED) },
    script: ({ opened }) =>
      opened === 'none'
        ? undefined
        : async (screen, user) => {
            await user.click(
              await screen.findByRole('button', { name: opened }),
            );
          },
  }),
} satisfies Meta<PageArgs & IntegrationsArgs>;

export default meta;

export const Integrations: StoryObj<typeof meta> = {};
