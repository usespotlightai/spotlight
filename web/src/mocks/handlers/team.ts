import type { RequestHandler } from 'msw';
import type {
  ChatResponseDto,
  ChatSummaryResponseDto,
  ChatTargetStationResponseDto,
  ProposedMemoryResponseDto,
  RememberRequestDto,
  RetireMemoryRequestDto,
  SendChatMessageRequestDto,
  StartChatRequestDto,
  TeamMemoryDetailResponseDto,
  TeamMemoryResponseDto,
  WriteMemoryRequestDto,
} from '@/lib/api';
import { api, json, noContent, notFound, problem } from '@/mocks/http';
import { taskOfRun, world } from '@/mocks/world';
import { SAM } from '@/mocks/world/people';
import {
  type ChatRecord,
  chatTurn,
  messageBy,
  teamChats,
  turnEndsAt,
} from '@/mocks/world/team-chats';
import { type MemoryRecord, teamMemories } from '@/mocks/world/team-memories';

const KINDS = [
  'rationale',
  'rejected-approach',
  'failure',
  'environment',
  'preference',
  'correction',
] as const;

const MAX_BODY = 1_000;
const MAX_REASON = 500;
const TITLE_LENGTH = 60;

let idCount = 0;

const nextId = (prefix: string): string => {
  idCount += 1;
  return `${prefix}_${Date.now().toString(36)}${idCount}`;
};

const now = (): string => new Date().toISOString();

const isKind = (raw: unknown): raw is MemoryRecord['kind'] =>
  KINDS.some((kind) => kind === raw);

const memoriesOf = (teamId: string): MemoryRecord[] | undefined =>
  teamMemories()[teamId];

const summaryOf = ({
  harness: _harness,
  steps: _steps,
  notes: _notes,
  ...summary
}: MemoryRecord): TeamMemoryResponseDto => summary;

const linkTo = (memories: readonly MemoryRecord[], id: string | null) => {
  const found = memories.find((each) => each.id === id);
  return found
    ? { id: found.id, handle: found.handle, body: found.body }
    : null;
};

const detailOf = (
  memories: readonly MemoryRecord[],
  memory: MemoryRecord,
): TeamMemoryDetailResponseDto => ({
  ...memory,
  superseded: linkTo(memories, memory.supersedes),
  successor: linkTo(memories, memory.retirement?.supersededBy ?? null),
});

const sinceOf = (memory: MemoryRecord): number =>
  Date.parse(memory.retirement?.at ?? memory.approvedAt);

const listed = (memories: readonly MemoryRecord[], query: URLSearchParams) => {
  const status = query.get('status') || 'active';
  const kind = query.get('kind');
  const lineId = query.get('lineId');
  const stationId = query.get('stationId');
  const repository = query.get('repository');
  const path = query.get('path');

  return memories
    .filter(
      (memory) =>
        memory.status === status &&
        (!kind || memory.kind === kind) &&
        (!lineId || memory.lineId === lineId) &&
        (!stationId || memory.stationId === stationId) &&
        (!repository || memory.repository === repository) &&
        (!path || memory.paths.some((each) => each.startsWith(path))),
    )
    .sort((a, b) => sinceOf(b) - sinceOf(a))
    .map(summaryOf);
};

const nextHandle = (): string => {
  const highest = Object.values(teamMemories())
    .flat()
    .map((memory) => Number(memory.handle.slice(2)))
    .reduce((max, each) => Math.max(max, each), 0);

  return `M-${highest + 1}`;
};

type Placed = Pick<
  MemoryRecord,
  'kind' | 'body' | 'scope' | 'lineId' | 'stationId' | 'repository' | 'paths'
>;

const placedFrom = (
  teamId: string,
  writing: Partial<WriteMemoryRequestDto>,
): Placed | string => {
  const body = writing.body?.trim() ?? '';
  if (!isKind(writing.kind)) {
    return 'Sorry, that is not a kind of memory.';
  }
  if (!body || body.length > MAX_BODY) {
    return `A memory needs between 1 and ${MAX_BODY} characters.`;
  }

  const lines = world().lines[teamId] ?? [];
  const line = writing.lineId
    ? lines.find((each) => each.id === writing.lineId)
    : null;
  if (writing.lineId && !line) {
    return 'Sorry, the team has no such line.';
  }
  const station = writing.stationId
    ? line?.stations.find((each) => each.id === writing.stationId)
    : null;
  if (writing.stationId && !station) {
    return 'Sorry, that line has no such station.';
  }
  const repositories = new Set(lines.flatMap((each) => each.repositories));
  if (writing.repository && !repositories.has(writing.repository)) {
    return 'Sorry, the team has no such repository.';
  }

  return {
    kind: writing.kind,
    body,
    scope: station ? 'station' : line ? 'line' : 'team',
    lineId: line?.id ?? null,
    stationId: station?.id ?? null,
    repository: writing.repository || null,
    paths: writing.repository ? (writing.paths ?? []) : [],
  };
};

const writtenBySam = (placed: Placed): MemoryRecord => ({
  id: nextId('memory'),
  handle: nextHandle(),
  source: 'person',
  status: 'active',
  approvedBy: SAM,
  approvedAt: now(),
  supersedes: null,
  retirement: null,
  provenance: null,
  runs: 0,
  harness: null,
  steps: [],
  notes: [],
  ...placed,
});

const memoryHandlers = [
  api.get('/teams/:teamId/memories', ({ params, request }) => {
    const memories = memoriesOf(String(params.teamId));
    if (!memories) {
      return notFound();
    }

    const query = new URL(request.url).searchParams;
    const status = query.get('status');
    const kind = query.get('kind');
    if (
      (status && status !== 'active' && status !== 'retired') ||
      (kind && !isKind(kind))
    ) {
      return problem(422, 'Sorry, no memory has that status or kind.');
    }

    return json(listed(memories, query));
  }),

  api.get('/teams/:teamId/memories/:memoryId', ({ params }) => {
    const memories = memoriesOf(String(params.teamId)) ?? [];
    const memory = memories.find((each) => each.id === params.memoryId);

    return memory ? json(detailOf(memories, memory)) : notFound();
  }),

  api.post('/teams/:teamId/memories', async ({ params, request }) => {
    const teamId = String(params.teamId);
    const memories = memoriesOf(teamId);
    if (!memories) {
      return notFound();
    }

    const placed = placedFrom(
      teamId,
      (await request.json()) as WriteMemoryRequestDto,
    );
    if (typeof placed === 'string') {
      return problem(422, placed);
    }

    const written = writtenBySam(placed);
    memories.push(written);

    return json(detailOf(memories, written), 201);
  }),

  api.post(
    '/teams/:teamId/memories/:memoryId/edit',
    async ({ params, request }) => {
      const teamId = String(params.teamId);
      const memories = memoriesOf(teamId) ?? [];
      const old = memories.find((each) => each.id === params.memoryId);
      if (!old) {
        return notFound();
      }
      if (old.retirement) {
        return problem(409, 'Sorry, that memory was already retired.');
      }

      const placed = placedFrom(
        teamId,
        (await request.json()) as WriteMemoryRequestDto,
      );
      if (typeof placed === 'string') {
        return problem(422, placed);
      }

      const successor: MemoryRecord = {
        ...writtenBySam(placed),
        supersedes: old.id,
        provenance: old.provenance,
        harness: old.harness,
        steps: old.steps,
        notes: old.notes,
      };
      old.status = 'retired';
      old.retirement = {
        at: successor.approvedAt,
        by: null,
        reason: null,
        supersededBy: successor.id,
      };
      memories.push(successor);

      return json(detailOf(memories, successor), 201);
    },
  ),

  api.post(
    '/teams/:teamId/memories/:memoryId/retire',
    async ({ params, request }) => {
      const memories = memoriesOf(String(params.teamId)) ?? [];
      const memory = memories.find((each) => each.id === params.memoryId);
      if (!memory) {
        return notFound();
      }
      if (memory.retirement) {
        return problem(409, 'Sorry, that memory was already retired.');
      }

      const { reason } = (await request.json()) as RetireMemoryRequestDto;
      const why = reason?.trim() ?? '';
      if (!why || why.length > MAX_REASON) {
        return problem(
          422,
          `A reason needs between 1 and ${MAX_REASON} characters.`,
        );
      }

      memory.status = 'retired';
      memory.retirement = {
        at: now(),
        by: SAM,
        reason: why,
        supersededBy: null,
      };

      return json(detailOf(memories, memory));
    },
  ),

  api.post('/runs/:runId/memories', async ({ params, request }) => {
    const runId = String(params.runId);
    const taskId = taskOfRun(runId);
    const run = world().runs[taskId ?? '']?.find((each) => each.id === runId);
    if (!run) {
      return notFound();
    }

    const input = (await request.json()) as RememberRequestDto;
    if (!isKind(input.kind) || !input.body?.trim()) {
      return problem(422, 'Sorry, that is not a memory the team can approve.');
    }

    const supersedes = input.supersedes
      ? (Object.values(teamMemories())
          .flat()
          .find((memory) => memory.handle === input.supersedes)?.id ?? null)
      : null;
    const remembered: ProposedMemoryResponseDto = {
      id: nextId('memory'),
      kind: input.kind,
      body: input.body.trim(),
      source: 'run',
      proposedBy: 'agent',
      state: 'proposed',
      scope: input.scope ?? 'line',
      repository: null,
      paths: input.paths ?? [],
      supersedes,
      decision: null,
      harness: run.harness,
      steps: [
        {
          index: 0,
          kind: 'remember',
          text: `spotlight remember --kind ${input.kind} --body "${input.body.trim()}"`,
        },
      ],
      notes: [],
    };

    return json(remembered, 201);
  }),
];

const chatsOf = (teamId: string): ChatRecord[] => {
  const chats = teamChats();
  chats[teamId] ??= [];
  return chats[teamId];
};

const chatIn = (teamId: string, chatId: unknown): ChatRecord | undefined =>
  teamChats()[teamId]?.find((each) => each.chat.id === chatId);

const summaryOfChat = ({
  runId: _runId,
  messages: _messages,
  ...summary
}: ChatResponseDto): ChatSummaryResponseDto => summary;

const targetStationOf = (
  teamId: string,
  stationId: string,
): ChatTargetStationResponseDto | null => {
  for (const line of world().lines[teamId] ?? []) {
    const station = line.stations.find((each) => each.id === stationId);
    if (station) {
      return {
        lineId: line.id,
        lineKey: line.key,
        lineName: line.name,
        stationId: station.id,
        stationKey: station.key,
        stationName: station.name,
      };
    }
  }

  return null;
};

const tracesOf = (teamId: string, taskIds: readonly string[]) =>
  (world().tasks[teamId] ?? [])
    .filter((task) => taskIds.includes(task.id))
    .map((task) => ({ taskId: task.id, title: task.title }));

const titleOf = (
  body: string,
  targetStation: ChatTargetStationResponseDto | null,
  traces: readonly { title: string }[],
): string => {
  const firstLine = body.trim().split('\n')[0]?.trim() ?? '';
  if (firstLine) {
    return firstLine.length > TITLE_LENGTH
      ? `${firstLine.slice(0, TITLE_LENGTH - 1).trimEnd()}…`
      : firstLine;
  }
  if (targetStation) {
    return `Improve ${targetStation.stationName}`;
  }

  return traces[0]?.title ?? 'New chat';
};

const runsAtStation = (stationId: string): number =>
  Object.values(world().runs)
    .flat()
    .filter((run) => run.station?.id === stationId).length;

const answerTo = (
  body: string,
  targetStation: ChatTargetStationResponseDto | null,
): string => {
  if (targetStation) {
    const runs = runsAtStation(targetStation.stationId);
    return `I read the last ${runs} ${runs === 1 ? 'run' : 'runs'} at ${targetStation.stationName} on ${targetStation.lineName}. The clearest pattern is work sent back from review for size: the agent keeps going after the change is done. Telling it to stop and open the pull request once the checks pass would have saved two of those round trips.`;
  }
  if (!body.trim()) {
    return 'I read what you shared. Tell me what you would like to change, and I will propose tasks for it.';
  }

  return 'Here is how I would break this down: first find where it happens in the code, then fix the cause rather than the symptom, then add a check so it cannot come back quietly. Say the word and I will propose those as tasks.';
};

const answered = (record: ChatRecord, sentAt: string, body: string): void => {
  const runId = `run_${record.chat.id}_${record.journals.length + 1}`;
  const journal = chatTurn(runId, sentAt, [
    { kind: 'thought', text: 'Reading what the team already has on this.' },
    {
      kind: 'tool',
      tool: 'bash',
      text: `spotlight recall "${body.trim().slice(0, 40)}"`,
    },
    { kind: 'message', text: answerTo(body, record.chat.targetStation) },
  ]);
  record.journals.push(journal);
  record.chat.updatedAt = turnEndsAt(journal);
  record.chat.working = false;
  record.chat.runId = null;
};

const chatHandlers = [
  api.get('/teams/:teamId/chats', ({ params }) =>
    json(
      (teamChats()[String(params.teamId)] ?? [])
        .map((each) => summaryOfChat(each.chat))
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    ),
  ),

  api.post('/teams/:teamId/chats', async ({ params, request }) => {
    const teamId = String(params.teamId);
    if (!world().lines[teamId]) {
      return notFound();
    }

    const input = (await request.json()) as StartChatRequestDto;
    const targetStation = input.targetStation
      ? targetStationOf(teamId, input.targetStation)
      : null;
    if (input.targetStation && !targetStation) {
      return problem(422, 'Sorry, the team has no such station.');
    }
    if (!input.harness) {
      return problem(422, 'A chat needs a harness.');
    }

    const traces = tracesOf(teamId, input.traces ?? []);
    const at = now();
    const record: ChatRecord = {
      chat: {
        id: nextId('chat'),
        title: titleOf(input.body, targetStation, traces),
        harness: input.harness,
        model: input.model ?? null,
        effort: input.effort ?? null,
        repositories: [
          ...new Set([
            ...(input.setup ? [input.setup.repository] : []),
            ...(input.repositories ?? []),
          ]),
        ],
        targetStation,
        setup: input.setup ? { ...input.setup, pullRequest: null } : null,
        createdAt: at,
        updatedAt: at,
        working: false,
        queued: false,
        runId: null,
        messages: [messageBy(SAM, 0, input.body, at, traces)],
      },
      journals: [],
    };
    answered(record, at, input.body);
    chatsOf(teamId).push(record);

    return json(record.chat, 201);
  }),

  api.get('/teams/:teamId/chats/:chatId', ({ params }) => {
    const record = chatIn(String(params.teamId), params.chatId);
    return record ? json(record.chat) : notFound();
  }),

  api.get('/teams/:teamId/chats/:chatId/journal', ({ params }) => {
    const record = chatIn(String(params.teamId), params.chatId);
    return record ? json(record.journals) : notFound();
  }),

  api.post(
    '/teams/:teamId/chats/:chatId/messages',
    async ({ params, request }) => {
      const record = chatIn(String(params.teamId), params.chatId);
      if (!record) {
        return notFound();
      }

      const { body, model, effort } =
        (await request.json()) as SendChatMessageRequestDto;
      const at = now();
      record.chat.messages.push(
        messageBy(SAM, record.chat.messages.length, body, at),
      );
      record.chat.model = model ?? record.chat.model;
      record.chat.effort = effort ?? record.chat.effort;
      answered(record, at, body);

      return noContent();
    },
  ),

  api.post(
    '/teams/:teamId/chats/:chatId/proposals/:position/acceptance',
    ({ params }) => {
      const teamId = String(params.teamId);
      const record = chatIn(teamId, params.chatId);
      const proposal = record?.chat.messages.find(
        (each) => each.position === Number(params.position),
      )?.proposal;
      if (!proposal) {
        return notFound();
      }
      if (proposal.state !== 'open') {
        return problem(409, 'Sorry, that proposal was already decided.');
      }

      const taskId = nextId('task');
      world().tasks[teamId] = [
        ...(world().tasks[teamId] ?? []),
        {
          id: taskId,
          stationId: proposal.stationId,
          revision: 0,
          title: proposal.title,
          description: proposal.description,
          attachments: [],
          createdAt: now(),
          running: false,
          queued: false,
          awaitingReview: null,
          pullRequest: null,
          createdBy: SAM,
          assignee: null,
          note: null,
        },
      ];
      proposal.state = 'created';
      proposal.taskId = taskId;

      return noContent();
    },
  ),

  api.post(
    '/teams/:teamId/chats/:chatId/proposals/:position/dismissal',
    ({ params }) => {
      const record = chatIn(String(params.teamId), params.chatId);
      const proposal = record?.chat.messages.find(
        (each) => each.position === Number(params.position),
      )?.proposal;
      if (!proposal) {
        return notFound();
      }
      if (proposal.state !== 'open') {
        return problem(409, 'Sorry, that proposal was already decided.');
      }

      proposal.state = 'dismissed';

      return noContent();
    },
  ),

  api.post('/teams/:teamId/chats/:chatId/stop', ({ params }) => {
    const record = chatIn(String(params.teamId), params.chatId);
    if (!record) {
      return notFound();
    }

    record.chat.working = false;
    record.chat.runId = null;

    return noContent();
  }),
];

export const teamHandlers: RequestHandler[] = [
  ...memoryHandlers,
  ...chatHandlers,
];
