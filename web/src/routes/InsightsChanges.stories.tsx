import type { Meta, StoryObj } from '@storybook/react-vite';
import { insightsPath } from '@/lib/insights';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ChangesArgs = {
  readonly impact: 'closed' | 'open' | 'outside';
};

const LOADED = { timeout: 5_000 };

const meta = {
  title: 'Team/Insights/Stations/Config changes',
  ...pageStory<ChangesArgs>({
    at: insightsPath(SLUG, PLATFORM_ID, {
      tab: 'stations',
      period: '30d',
      filter: {},
      page: 1,
    }),
    args: { impact: 'closed' },
    argTypes: {
      impact: choice('Impact', {
        closed: 'Closed',
        open: 'Open',
        outside: 'Open, outside the period',
      }),
    },
    script: ({ impact }) =>
      impact === 'closed'
        ? undefined
        : async (screen, user) => {
            await user.click(
              (
                await screen.findAllByRole('button', { name: 'Impact' }, LOADED)
              )[0],
            );
            if (impact === 'outside') {
              await user.click(
                screen.getByRole('button', { name: 'Time range' }),
              );
              (
                await screen.findByRole(
                  'menuitemradio',
                  { name: /Past 7 days/ },
                  LOADED,
                )
              ).click();
            }
          },
  }),
} satisfies Meta<PageArgs & ChangesArgs>;

export default meta;

export const ConfigChanges: StoryObj<typeof meta> = { name: 'Config changes' };
