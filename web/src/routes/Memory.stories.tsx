import type { Meta, StoryObj } from '@storybook/react-vite';
import { Route } from 'react-router';
import { KIND_OPTIONS } from '@/lib/memory';
import { teamSectionPath } from '@/lib/team';
import { Memory } from '@/routes/Memory';
import {
  MEMORY_PAGE_STATES,
  type MemoryPageArgs,
  memoryPageQuery,
  OPENABLE,
  SLUG,
  seedMemoryPage,
  TEAM_ID,
} from '@/stories/fixtures/team-memory';
import { StoryPage } from '@/stories/StoryPage';

const routes = (
  <Route path="/w/:slug/team/:teamId/memory" element={<Memory />} />
);

const at = teamSectionPath(SLUG, TEAM_ID, 'memory');

const meta = {
  title: 'Team/Memory',
  args: {
    state: 'data',
    standing: 'stands',
    kind: 'any',
    count: 3,
    opened: 'none',
    writing: false,
  },
  argTypes: {
    state: {
      name: 'State',
      control: 'inline-radio',
      options: MEMORY_PAGE_STATES,
      labels: {
        data: 'With data',
        empty: 'Empty',
        loading: 'Loading',
        error: 'Error',
      },
    },
    standing: {
      name: 'Tab',
      control: 'inline-radio',
      options: ['stands', 'retired'],
      labels: { stands: 'Standing', retired: 'Retired' },
    },
    kind: {
      name: 'Kind filter',
      control: 'select',
      options: ['any', ...KIND_OPTIONS.map((each) => each.value)],
      labels: Object.fromEntries([
        ['any', 'Every kind'],
        ...KIND_OPTIONS.map((each) => [each.value, each.label]),
      ]),
    },
    count: {
      name: 'Standing memories',
      control: { type: 'range', min: 0, max: 30 },
    },
    opened: {
      name: 'Opened memory',
      control: 'select',
      options: ['none', ...OPENABLE],
    },
    writing: { name: 'Writing a new memory', control: 'boolean' },
  },
  render: (args) => (
    <StoryPage
      key={JSON.stringify(args)}
      at={`${at}${memoryPageQuery(args)}`}
      seed={seedMemoryPage(args)}
    >
      {routes}
    </StoryPage>
  ),
} satisfies Meta<MemoryPageArgs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { state: 'loading' },
};

export const Empty: Story = {
  args: { state: 'empty' },
};

export const Failed: Story = {
  name: 'Error',
  args: { state: 'error' },
};

export const WithData: Story = {};

export const Opened: Story = {
  args: { opened: 'memory_gone' },
};

export const Editing: Story = {
  args: { opened: 'memory_gone' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Edit' }));
  },
};

export const Writing: Story = {
  args: { writing: true },
};

export const Filtered: Story = {
  args: { kind: 'rationale' },
};

export const Retired: Story = {
  args: { standing: 'retired' },
};
