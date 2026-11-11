import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';

import { Conversation } from '@/components/features/inbox/conversation/Conversation';
import type { ConversationItem, Note, RunJournal } from '@/lib/inbox';

const TURNS = 64;
const HOUR_MS = 3_600_000;
const STARTED = Date.parse('2026-10-30T08:00:00.000Z');
const STATION = {
  name: 'Implementation',
  color: '#4f8cf7',
  position: 2,
  count: 4,
};
const FILES = [
  'src/retries/deliver.ts',
  'src/retries/worker.ts',
  'src/queue/backoff.ts',
];

const at = (turn: number, seconds = 0): string =>
  new Date(STARTED + turn * HOUR_MS + seconds * 1_000).toISOString();

const note = (
  turn: number,
  over: Pick<Note, 'position' | 'voice' | 'body' | 'at'> & Partial<Note>,
): Note => ({
  kind: over.voice === 'person' ? 'answered' : 'asked',
  form: 'words',
  station: STATION.name,
  stationColor: STATION.color,
  stationPosition: STATION.position,
  runId: over.voice === 'person' ? null : `run_long_${turn}`,
  attachments: [],
  author: null,
  coAuthors: [],
  approval: null,
  failure: null,
  connection: null,
  ...over,
});

const notes: Note[] = Array.from({ length: TURNS }, (_, turn) => [
  ...(turn > 0
    ? [
        note(turn, {
          position: turn * 2 - 1,
          voice: 'person',
          body: `Do pass ${turn + 1}.`,
          at: at(turn),
        }),
      ]
    : []),
  note(turn, {
    position: turn * 2,
    voice: 'station',
    body: `Pass ${turn + 1} is done. The backoff now waits up to ${2 ** (turn % 6)} seconds with jitter, and the tests pass.`,
    at: at(turn, 240),
  }),
]).flat();

const step = (
  turn: number,
  place: number,
  over: Partial<RunJournal['steps'][number]>,
): RunJournal['steps'][number] => ({
  kind: 'tool',
  text: '',
  status: 'completed',
  tool: null,
  detail: null,
  ms: 1_800,
  startedAt: at(turn, 10 + place * 30),
  locations: [],
  input: null,
  output: null,
  change: null,
  ...over,
});

const worked: RunJournal[] = Array.from({ length: TURNS }, (_, turn) => ({
  runId: `run_long_${turn}`,
  attempt: 1,
  ms: 230_000,
  spans: [],
  marks: {
    startedAt: at(turn, 5),
    readyAt: at(turn, 8),
    firstAgentUpdateAt: at(turn, 9),
    lastAgentUpdateAt: at(turn, 235),
    agentStoppedAt: null,
    endedAt: at(turn, 235),
  },
  spent: { used: 24_000, size: 200_000, cost: null, currency: null },
  steps: [
    step(turn, 0, { kind: 'thought', text: 'Check the backoff first.' }),
    step(turn, 1, { tool: 'read', text: FILES[turn % FILES.length] ?? '' }),
    step(turn, 2, {
      tool: 'execute',
      text: `npm test -- backoff --shard ${turn + 1}`,
      detail: Array.from(
        { length: 40 },
        (_, line) => `✓ backoff waits ${2 ** (line % 8)}s on retry ${line + 1}`,
      ).join('\n'),
    }),
    step(turn, 3, {
      tool: 'edit',
      text: FILES[(turn + 1) % FILES.length] ?? '',
    }),
  ],
}));

const item: ConversationItem = {
  id: 'task_long',
  teamId: 'team_platform',
  createdAt: at(0),
  station: STATION,
  progress: null,
  notes,
};

const meta = {
  title: 'Team/Runs/Run/Long conversation',
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="flex h-dvh flex-col bg-surface">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => <Conversation item={item} worked={worked} footer={null} />,
} satisfies Meta;

export default meta;

export const SixtyFourTurns: StoryObj<typeof meta> = {};
