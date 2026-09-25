import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { TraceParentPort } from '@work/application/ports/trace-parent.port';
import { DispatchChat } from '@work/application/services/dispatch-chat.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { HarnessCommand } from '@work/domain/value-objects/harness-command.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-23T09:00:00.000Z');
const API = Repository.of('acme/api');

const ends = (key: string, kind: 'backlog' | 'completed', position: number) =>
  Station.of({
    id: StationId.of(`${key}-${kind}`),
    key: StationKey.of(kind),
    name: StationName.of(kind),
    position,
    color: StationColor.plain(),
    kind,
  });

const line = (key: string, repositories: Repository[], runners: string[]) =>
  Line.rehydrate({
    id: LineId.of(key),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of(key),
    name: LineName.of(key),
    repositories,
    placement: RunnerPlacement.of(runners),
    stations: [ends(key, 'backlog', 0), ends(key, 'completed', 1)],
  });

const chatIn = (repositories: Repository[]) =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: UserId.of('user_1'),
    harness: HarnessId.of('claude-code'),
    repositories,
    body: ChatMessageBody.of('Plan the retries.'),
    now: NOW,
    newId: () => 'chat_1',
  });

const enqueued = async (chat: Chat): Promise<Run> => {
  const add = vi.fn(async (_run: Run) => {});

  await new DispatchChat(
    { add } as unknown as RunRepository,
    { generate: () => 'id' } as IdGeneratorPort,
    {
      commandFor: () => HarnessCommand.of({ executable: 'claude-agent-acp' }),
    } as unknown as HarnessLaunchPort,
    { forChat: () => '00-trace-span-01' } as unknown as TraceParentPort,
    { find: async () => null } as unknown as TeamDirectoryPort,
    {
      ofTeam: async () => [
        line('api', [API], ['vpc-internal']),
        line('web', [Repository.of('acme/web')], ['gpu']),
      ],
    } as unknown as LineRepository,
    { now: () => NOW } as ClockPort,
  ).enqueue(chat, RunId.of('run_1'));

  return add.mock.calls[0]?.[0] as Run;
};

describe('DispatchChat', () => {
  it('places a chat run where the lines working in its repositories run', async () => {
    const run = await enqueued(chatIn([API]));

    expect(run.placement.admits(RunnerTerms.of(['vpc-internal']))).toBe(true);
    expect(run.placement.admits(RunnerTerms.of(['gpu']))).toBe(false);
  });

  it('places a chat run working in no repository anywhere', async () => {
    expect((await enqueued(chatIn([]))).placement.isAnywhere).toBe(true);
  });
});
