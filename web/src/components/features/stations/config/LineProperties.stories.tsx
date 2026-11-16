import type { Meta, StoryObj } from '@storybook/react-vite';

import { LineProperties } from '@/components/features/stations/config/LineProperties';
import type { LineResponseDto } from '@/lib/api';

const LINE: LineResponseDto = {
  id: 'line_1',
  key: 'default',
  name: 'Default',
  stations: [],
  reactions: [],
  repositories: [
    {
      fullName: 'usespotlightai/spotlight',
      host: 'github',
      url: 'https://github.com/usespotlightai/spotlight',
    },
  ],
  source: null,
  replayCheck: null,
  search: {
    enabled: true,
    monthlyCeiling: 50,
    currency: 'USD',
    ceiling: 10,
    period: '7d',
    onAlert: true,
    cooldown: '3d',
  },
};

const meta = {
  title: 'Stations/LineProperties',
  component: LineProperties,
  args: { line: LINE, skills: [], tools: [] },
} satisfies Meta<typeof LineProperties>;

export default meta;

export const WithTools: StoryObj<typeof meta> = {
  args: {
    skills: ['grafana-dashboards', 'research'],
    tools: [
      {
        value: 'pull-request',
        called: 'pull-request',
        origin: 'built-in',
      },
      {
        value: 'grafana.search',
        called: 'grafana.search',
        origin: 'integration',
      },
      {
        value: 'catalog.web-search@1.1.0',
        called: 'catalog.web-search',
        origin: 'catalog',
      },
    ],
  },
};

export const NoTools: StoryObj<typeof meta> = {};
