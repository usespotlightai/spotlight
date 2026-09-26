import { Attached } from '@work/application/rendering/attached';
import { Traced } from '@work/application/rendering/traced';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { ChatMessage } from '@work/domain/entities/chat-message.entity';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

const opening = (team: string | null): string =>
  [
    `You are planning work together with a person${team ? ` on the ${team} team` : ''}. Talk it through with them: ask what you need to know, read the code, and shape what they want into tasks their lines can work.`,
    'You are not here to make the change yourself. Do not edit files, commit or push anything.',
  ].join(' ');

const linesOf = (lines: readonly Line[]): string =>
  lines.length === 0
    ? '## The lines\n\nThe team has no lines yet, so there is nowhere to propose a task.'
    : [
        '## The lines',
        'Work moves along lines of stations. A task starts at a station and is passed along the line from there.',
        ...lines.map((line) =>
          [
            `### ${line.name.value} (\`${line.key.value}\`)`,
            line.stations
              .map((station) =>
                [
                  `- \`${station.key.value}\` — ${station.name.value}`,
                  station.description?.value.trim(),
                ]
                  .filter(Boolean)
                  .join(': '),
              )
              .join('\n'),
          ].join('\n\n'),
        ),
      ].join('\n\n');

const workspaceOf = (chat: Chat): string =>
  chat.repositories.length === 0
    ? '## The workspace\n\nNo repository is checked out. Ask where the code lives if you need to read it.'
    : [
        '## The workspace',
        'These repositories are checked out side by side, each in its own directory:',
        chat.repositories
          .map((each) => `- \`${each.name}/\` — ${each.value}`)
          .join('\n'),
      ].join('\n\n');

const proposing = [
  '## Proposing tasks',
  'Once the two of you have settled on a piece of work, propose it, from anywhere in the workspace:',
  '```\nspotlight propose-task --line <line> --station <station> --title "…" < description.md\n```',
  'Name the line and the station by their keys. Propose one task for each piece of work that can be done and reviewed on its own, and put in the description everything whoever works it needs to know, since they will not see this conversation.',
  'The person sees each proposal here and decides whether to create it. Nothing is created until they do, so do not propose anything they have not agreed to.',
  'Each proposal is shown to them in full the moment you make it, so do not list or summarise what you proposed afterwards. A short line saying it is their move is enough.',
].join('\n\n');

const proposedSoFar = (chat: Chat, lines: readonly Line[]): string | null => {
  const proposals = chat.messages.flatMap((message) =>
    message.proposal ? [message.proposal] : [],
  );

  if (proposals.length === 0) {
    return null;
  }

  return [
    '## Proposed so far',
    proposals
      .map((each) => {
        const line = lines.find((candidate) =>
          candidate.id.equals(each.placement.lineId),
        );
        const station = line?.stationAt(each.placement.stationId);

        return `- ${each.title.value} (${station?.name.value ?? 'a station that is gone'}, ${each.state})`;
      })
      .join('\n'),
  ].join('\n\n');
};

const words = (message: ChatMessage): string =>
  [
    Attached.beside(message.body.value, message.attachments),
    Traced.listed(message.traces),
  ]
    .filter(Boolean)
    .join('\n\n');

const tracing = (messages: readonly ChatMessage[]): boolean =>
  messages.some((message) => message.traces.length > 0);

export const ChatBriefing = {
  brief(input: {
    chat: Chat;
    team: string | null;
    lines: readonly Line[];
  }): string {
    const said = input.chat.messages.filter(
      (message) => message.kind === 'said',
    );

    return [
      opening(input.team),
      linesOf(input.lines),
      workspaceOf(input.chat),
      proposing,
      proposedSoFar(input.chat, input.lines),
      tracing(said) ? Traced.reading : null,
      ['## What they said', ...said.map(words)].join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
  },

  followUp(chat: Chat, handed: readonly MessagePosition[]): string {
    const given = chat.messagesAt(handed);
    const earlier = chat.messages.filter(
      (message) =>
        !given.includes(message) &&
        given.some((each) => message.position.isAtOrBefore(each.position)),
    );
    const firstTraces = tracing(given) && !tracing(earlier);

    return [firstTraces ? Traced.reading : null, ...given.map(words)]
      .filter(Boolean)
      .join('\n\n');
  },
};
