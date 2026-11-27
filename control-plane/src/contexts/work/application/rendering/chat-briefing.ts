import type { Release } from '@shared-kernel/domain/value-objects/release.vo';
import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import { Attached } from '@work/application/rendering/attached';
import { ConfiguringSpotlight } from '@work/application/rendering/configuring-spotlight';
import { Learned } from '@work/application/rendering/learned';
import { SettingUp } from '@work/application/rendering/setting-up';
import { SpotlightCli } from '@work/application/rendering/spotlight-cli';
import { Traced } from '@work/application/rendering/traced';
import type { Chat } from '@work/domain/aggregates/chat.aggregate';
import type { ChatMessage } from '@work/domain/entities/chat-message.entity';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { MessagePosition } from '@work/domain/value-objects/message-position.vo';

const opening = (team: string | null): string =>
  [
    `You are working together with a person${team !== null && team !== '' ? ` on the ${team} team` : ''}. Talk it through with them: ask what you need to know, read the code, and shape what they want into tasks their lines can work.`,
    'When they ask you to make a small change yourself, make it here and open its pull request. Do not edit files before they ask.',
  ].join(' ');

const linesOf = (lines: readonly LineMap[]): string =>
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
                  station.description?.trim(),
                ]
                  .filter(Boolean)
                  .join(': '),
              )
              .join('\n'),
          ].join('\n\n'),
        ),
      ].join('\n\n');

const workingCopyOf = (chat: Chat): string =>
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
  'Once the two of you have agreed on a piece of work, propose it, from anywhere in the workspace:',
  '```\nspotlight tools call propose-task --line <line> --station <station> --title "…" < description.md\n```',
  'Name the line and the station by their keys. Propose one task for each piece of work that can be done and reviewed on its own, and put in the description everything whoever works it needs to know, since they will not see this conversation.',
  'Whoever works it does not see the files attached here either. Give the task each file it needs with `--attach <path>`, once for each file. A path written only in the description does not reach them.',
  'The person sees each proposal here and decides whether to create it. Nothing is created until they do, so do not propose anything they have not agreed to.',
  'Each proposal is shown to them in full the moment you make it, so do not list or summarise what you proposed afterwards. A short line saying it is their move is enough.',
  'When a new proposal takes the place of earlier ones, name each earlier one with `--replaces <number>`. Its number is in the list of proposals so far. The person then sees the earlier one as replaced, and does not have to dismiss it.',
].join('\n\n');

const changing = [
  '## Making a change here',
  'Make a change yourself only when the person asks for it, and only when it is small: a few files that one pull request can hold. When the work is bigger, needs a plan, or has parts that can be done on their own, propose tasks instead, and say why.',
  'For each repository you change, create a new branch from the default branch, named like `fix/video-icons` or `feat/csv-export`. Commit your change on it and push it with `git push -u origin HEAD`. Never push to the default branch.',
  'Then open the pull request:',
  '```\nspotlight tools call open-pull-request --repository <owner/name> --branch <branch> --title "…" < body.md\n```',
  'A task on the line tracks the pull request. It waits on hold at the station that holds pull requests, and the line does not work on it while the person works with you.',
  'When a check fails, someone reviews the pull request or a teammate writes on the task, you hear it here. Fix what it asks for and push to the same branch. More changes to the same work go to the same branch too. Use a new branch only for new work, and open a new pull request for it.',
  'The person can hand the task to the line at any time. When the pull request is merged, the task completes.',
].join('\n\n');

const openedSoFar = (chat: Chat): string | null => {
  const opened = chat.pullRequests;

  if (opened.length === 0) {
    return null;
  }

  return [
    '## Your pull requests',
    opened.map((each) => `- ${each.url.value}`).join('\n'),
  ].join('\n\n');
};

const proposedSoFar = (
  chat: Chat,
  lines: readonly LineMap[],
): string | null => {
  const { proposals } = chat;

  if (proposals.length === 0) {
    return null;
  }

  return [
    '## Proposed so far',
    proposals
      .map(({ number, proposal }) => {
        const line = lines.find((candidate) =>
          candidate.id.equals(proposal.placement.lineId),
        );
        const station = line?.stationAt(proposal.placement.stationId);

        return `${number}. ${proposal.title.value} (${station?.name.value ?? 'a station that is gone'}, ${proposal.state})`;
      })
      .join('\n'),
  ].join('\n\n');
};

const words = (message: ChatMessage): string =>
  message.kind === 'happened'
    ? `From the pull request's task:\n\n${message.body.value}`
    : [
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
    lines: readonly LineMap[];
    memories: readonly BriefedMemory[];
    memoryFolder: MemoryFolder | null;
    spotlightUrl: string;
    release: Release | null;
    extensions: readonly string[];
  }): string {
    const messages = input.chat.messages.filter(
      (message) => message.kind === 'message' || message.kind === 'happened',
    );

    const setup = input.chat.setup;

    return [
      setup ? SettingUp.opening(input.team) : opening(input.team),
      linesOf(input.lines),
      workingCopyOf(input.chat),
      setup
        ? SettingUp.section(
            setup,
            input.chat.workspaceId.value,
            input.chat.repositories,
            input.spotlightUrl,
            input.release,
          )
        : null,
      ...input.extensions,
      Learned.section(input.memories),
      Learned.rest({
        folder: input.memoryFolder,
        briefed: input.memories.length > 0,
      }),
      SpotlightCli.section,
      ConfiguringSpotlight.section,
      proposing,
      setup ? null : changing,
      proposedSoFar(input.chat, input.lines),
      openedSoFar(input.chat),
      tracing(messages) ? Traced.reading : null,
      ['## Their messages', ...messages.map(words)].join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n\n');
  },

  followUp(chat: Chat, handed: readonly MessagePosition[]): string {
    const delivered = chat.messagesAt(handed);
    const earlier = chat.messages.filter(
      (message) =>
        !delivered.includes(message) &&
        delivered.some((each) => message.position.isAtOrBefore(each.position)),
    );
    const firstTraces = tracing(delivered) && !tracing(earlier);

    return [firstTraces ? Traced.reading : null, ...delivered.map(words)]
      .filter(Boolean)
      .join('\n\n');
  },
};
