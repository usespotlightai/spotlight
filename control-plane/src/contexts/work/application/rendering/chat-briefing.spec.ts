import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  BriefedMemory,
  MemoryFolder,
} from '@work/application/ports/team-memories.port';
import { ChatBriefing } from '@work/application/rendering/chat-briefing';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { ChatHandedToRun } from '@work/domain/events/chat-handed-to-run.event';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TraceReference } from '@work/domain/value-objects/trace-reference.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const LEON = UserId.of('user_1');

const traceOf = (id: string, title: string) =>
  TraceReference.of({
    taskId: TaskId.of(id),
    title: TaskTitle.of(title),
    teamId: TeamId.of('team_1'),
  });

const started = (traces: readonly TraceReference[] = []) =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.given('Why did these fail?'),
    traces,
    now: NOW,
    newId: () => 'chat_1',
  });

const brief = (
  chat: Chat,
  memories: readonly BriefedMemory[] = [],
  memoryFolder: MemoryFolder | null = null,
  lines: readonly Line[] = [],
) => ChatBriefing.brief({ chat, team: 'Core', lines, memories, memoryFolder });

const DELIVERY = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    Station.of({
      id: StationId.of('station_0'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      color: StationColor.of('#a3a8b0'),
      kind: 'backlog',
    }),
    Station.of({
      id: StationId.of('station_2'),
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      position: 2,
      color: StationColor.of('#a3a8b0'),
      kind: 'completed',
    }),
    Station.of({
      id: StationId.of('station_1'),
      key: StationKey.of('implementation'),
      name: StationName.of('Building'),
      position: 1,
      color: StationColor.of('#a3a8b0'),
      harness: HarnessId.of('claude-code'),
      kind: 'work',
    }),
  ],
});

const followingUp = (chat: Chat, traces: readonly TraceReference[]) => {
  const handed = chat
    .handedTo(RunId.of('run_1'), NOW)
    .endRun(RunId.of('run_1'))
    .said({
      by: LEON,
      body: ChatMessageBody.given('And this one?'),
      traces,
      at: NOW,
    })
    .handedTo(RunId.of('run_2'), NOW);
  const event = handed
    .pullEvents()
    .filter((each): each is ChatHandedToRun => each instanceof ChatHandedToRun)
    .pop();

  return ChatBriefing.followUp(handed, event?.handed ?? []);
};

const improvingChat = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.given('Improve this station.'),
    improving: IMPLEMENTATION,
    now: NOW,
    newId: () => 'chat_1',
  });

const IMPLEMENTATION = ImprovedStation.rehydrate({
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  lineKey: LineKey.of('delivery'),
  lineName: LineName.of('Delivery'),
  stationId: StationId.of('station_1'),
  stationKey: StationKey.of('implementation'),
  stationName: StationName.of('Implementation'),
});

describe('ChatBriefing', () => {
  it('briefs a chat improving a station to read its history first, and to propose Terraform', () => {
    const briefed = brief(improvingChat(), [], null, [DELIVERY]);

    expect(briefed).toContain('## Improving a station');
    expect(briefed).toContain('the Building station');
    expect(briefed).toContain(
      'spotlight history --line delivery --station implementation --last 30',
    );
    expect(briefed).toContain('Propose one change at a time');
    expect(briefed).toContain('prompts/<team>/delivery/implementation.md');
  });

  it('tells the agent when the station it was to improve is gone', () => {
    const briefed = brief(improvingChat());

    expect(briefed).toContain('no longer on the team');
    expect(briefed).not.toContain('spotlight history');
  });

  it('says nothing of improving a station where none was shared', () => {
    expect(brief(started())).not.toContain('spotlight history');
  });

  it('gives the command for each shared trace, and how to read one', () => {
    const briefed = brief(started([traceOf('task_1', 'Retries back off')]));

    expect(briefed).toContain(
      '- Retries back off: `spotlight trace --task task_1`',
    );
    expect(briefed).toContain('## Reading a trace');
  });

  it('says nothing of traces where none was shared', () => {
    const briefed = brief(started());

    expect(briefed).not.toContain('spotlight trace');
    expect(briefed).not.toContain('## Reading a trace');
  });

  it('follows up with what was said since the last run', () => {
    const followed = followingUp(started(), []);

    expect(followed).toBe('And this one?');
  });

  it('explains reading a trace when the first one comes later', () => {
    const followed = followingUp(started(), [
      traceOf('task_2', 'Checks go red'),
    ]);

    expect(followed).toContain('`spotlight trace --task task_2`');
    expect(followed).toContain('## Reading a trace');
  });

  it('does not explain reading a trace twice', () => {
    const followed = followingUp(
      started([traceOf('task_1', 'Retries back off')]),
      [traceOf('task_2', 'Checks go red')],
    );

    expect(followed).toContain('`spotlight trace --task task_2`');
    expect(followed).not.toContain('## Reading a trace');
  });

  it('gives a fresh chat what the team has learned', () => {
    const briefing = brief(started(), [
      {
        id: 'memory_1',
        handle: 'M-3',
        kind: 'preference',
        body: 'Name branches after the ticket.',
      },
    ]);

    expect(briefing).toContain('## What the team has learned');
    expect(briefing).toContain(
      '- **M-3** · preference: Name branches after the ticket.',
    );
  });

  it('points a chat at the memory folder, without the line or station, and never asks it to remember', () => {
    const briefing = brief(started(), [], {
      path: '.spotlight/memory',
      layout: [
        { folder: 'team/', level: 'the whole team' },
        {
          folder: 'repositories/<owner>/<name>/<path>/',
          level: 'a repository, or a file or folder in it',
        },
      ],
      mirroring: 'repositories/',
    });

    expect(briefing).toContain('## The rest of what the team remembers');
    expect(briefing).toContain('`.spotlight/memory/`');
    expect(briefing).not.toContain('station/ ');
    expect(briefing).not.toContain('spotlight remember');
  });

  it('says nothing of a memory folder where nothing applies', () => {
    expect(brief(started())).not.toContain(
      'The rest of what the team remembers',
    );
  });

  describe('a setup chat', () => {
    const setup = Chat.start({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      startedBy: LEON,
      harness: HarnessId.of('claude-code'),
      body: ChatMessageBody.given('Set up our configuration.'),
      setup: ConfigHome.of({ repository: 'acme/infra', folder: 'spotlight' }),
      now: NOW,
      newId: () => 'chat_1',
    });

    it('asks for a pull request with the team’s Terraform, never an apply', () => {
      const briefing = brief(setup);

      expect(briefing).toContain('Spotlight configuration as code');
      expect(briefing).toContain('Never run `terraform apply`');
      expect(briefing).not.toContain(
        'You are not here to make the change yourself',
      );
    });

    it('names where the configuration goes, as checked out', () => {
      const briefing = brief(setup);

      expect(briefing).toContain('`acme/infra`, under `spotlight/`');
      expect(briefing).toContain('`infra/spotlight/`');
      expect(briefing).toContain('spotlight setup-pull-request');
      expect(briefing).toContain(
        '"$SPOTLIGHT_URL/api/resources/workspaces/ws_1/export"',
      );
      expect(briefing).toContain('terraform plan');
    });

    it('checks out the configuration’s repository', () => {
      expect(setup.repositories.map((each) => each.value)).toEqual([
        'acme/infra',
      ]);
    });
  });
});
