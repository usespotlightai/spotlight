import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import type { Note, RunJournal } from '@/lib/inbox';

const STARTED = Date.parse('2026-11-09T08:00:00.000Z');
const STATION = {
  name: 'Implementation',
  color: '#4f8cf7',
  position: 2,
  count: 4,
};

const at = (seconds: number): string =>
  new Date(STARTED + seconds * 1_000).toISOString();

type Step = RunJournal['steps'][number];

const step = (seconds: number, over: Partial<Step>): Step => ({
  kind: 'tool',
  text: '',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 1_800,
  startedAt: at(seconds),
  locations: [],
  input: null,
  output: null,
  change: null,
  ...over,
});

const journal = (steps: Step[], live: boolean): RunJournal => ({
  runId: 'run_background',
  attempt: 1,
  ms: 600_000,
  spans: [],
  marks: {
    startedAt: at(0),
    readyAt: at(3),
    firstAgentUpdateAt: at(4),
    lastAgentUpdateAt: at(600),
    agentStoppedAt: null,
    endedAt: live ? null : at(600),
  },
  spent: { used: 36_000, size: 200_000, cost: null, currency: null },
  steps,
});

const delegated = step(20, {
  kind: 'subagent',
  text: 'Explore',
  ms: 42_000,
  input: 'Find where the agent chat shows its skeleton.',
  detail:
    '- grep AgentChatSkeleton\n- Read web/src/routes/AgentChat.tsx\nThe skeleton shows while a new run journal loads.',
  output: 'AgentChat.tsx shows the skeleton when loading(journal) is true.',
});

const started = [
  step(5, {
    kind: 'message',
    text: 'I am looking for the cause.',
    status: null,
  }),
  delegated,
  step(70, {
    tool: 'execute',
    text: 'npx vitest run',
    detail: 'Command moved to the background.',
  }),
];

const note = (body: string, seconds: number): Note => ({
  position: 0,
  kind: 'asked',
  form: 'words',
  voice: 'station',
  body,
  at: at(seconds),
  station: STATION.name,
  stationColor: STATION.color,
  stationPosition: STATION.position,
  runId: 'run_background',
  attachments: [],
  author: null,
  coAuthors: [],
  approval: null,
  failure: null,
  connection: null,
});

const render = (worked: RunJournal[], said: Note) => () => (
  <Conversation
    item={{
      id: 'task_background',
      teamId: 'team_platform',
      createdAt: at(0),
      station: STATION,
      progress: null,
      notes: [said],
    }}
    worked={worked}
    footer={null}
  />
);

const meta = {
  title: 'Team/Runs/Run/Background work',
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="flex h-dvh flex-col bg-surface">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(
      await canvas.findByRole('button', { name: /Worked for/ }),
    );
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Waiting: Story = {
  render: render(
    [
      journal(
        [
          ...started,
          step(75, {
            kind: 'waited',
            text: 'npx vitest run',
            status: 'running',
            ms: 120_000,
          }),
        ],
        true,
      ),
    ],
    note('I am waiting for the full test run in the background.', 200),
  ),
};

export const WokeAndHandedOver: Story = {
  render: render(
    [
      journal(
        [
          ...started,
          step(75, { kind: 'waited', text: 'npx vitest run', ms: 180_000 }),
          step(255, {
            kind: 'message',
            text: 'All 412 tests pass. I hand the task to Code Review.',
            status: null,
          }),
        ],
        false,
      ),
    ],
    note('All 412 tests pass. I hand the task to Code Review.', 260),
  ),
};

export const StoppedAtTheLimit: Story = {
  render: render(
    [
      journal(
        [
          ...started,
          step(75, {
            kind: 'waited',
            text: 'npx vitest run',
            ms: 1_800_000,
            detail: 'Still running at the wait limit: npx vitest run',
          }),
          step(1875, {
            kind: 'reminded',
            text: 'the agent to hand over',
            status: null,
            detail:
              'Your turn ended without a handover. These background tasks still run: npx vitest run.',
          }),
          step(1880, {
            kind: 'lost',
            text: 'npx vitest run when the run ended',
            status: 'failed',
            ms: 0,
          }),
        ],
        false,
      ),
    ],
    note('The full test run did not end in the wait limit.', 1880),
  ),
};
