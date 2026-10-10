import type { Meta, StoryObj } from '@storybook/react-vite';
import { choice, type PageArgs, pageStory } from '@/stories/application';

type ChangeStackArgs = {
  readonly opened: 'none' | 'layer' | 'repository';
};

const OPENED_QUERY: Record<ChangeStackArgs['opened'], string> = {
  none: '',
  layer: '?layer=c1.l2',
  repository: '?repository=acme%2Fworker',
};

const meta = {
  title: 'Team/Runs/Change stack',
  ...pageStory<ChangeStackArgs>({
    at: ({ opened }) =>
      `/w/acme/team/team_platform/runs/run_postgres_2/changes${OPENED_QUERY[opened]}`,
    args: { opened: 'none' },
    argTypes: {
      opened: choice('Opened', {
        none: 'None',
        layer: 'Second layer',
        repository: 'Second repository',
      }),
    },
  }),
} satisfies Meta<PageArgs & ChangeStackArgs>;

export default meta;

export const ChangeStack: StoryObj<typeof meta> = { name: 'Change stack' };
