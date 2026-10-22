import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
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
import { ChatDispatched } from '@work/domain/events/chat-dispatched.event';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { CiSetup } from '@work/domain/value-objects/ci-setup.vo';
import { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TargetStation } from '@work/domain/value-objects/target-station.vo';
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
    body: ChatMessageBody.fromInput('Why did these fail?'),
    traces,
    now: NOW,
    newId: () => 'chat_1',
  });

const brief = (
  chat: Chat,
  memories: readonly BriefedMemory[] = [],
  memoryFolder: MemoryFolder | null = null,
  lines: readonly Line[] = [],
) =>
  ChatBriefing.brief({
    chat,
    team: 'Core',
    lines,
    memories,
    memoryFolder,
    spotlightUrl: 'https://app.usespotlight.ai/',
  });

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
    .assignRun(RunId.of('run_1'), NOW)
    .endRun(RunId.of('run_1'))
    .addMessage({
      by: LEON,
      body: ChatMessageBody.fromInput('And this one?'),
      traces,
      at: NOW,
    })
    .assignRun(RunId.of('run_2'), NOW);
  const event = handed
    .pullEvents()
    .filter((each): each is ChatDispatched => each instanceof ChatDispatched)
    .pop();

  return ChatBriefing.followUp(handed, event?.acknowledged ?? []);
};

const targetStationChat = () =>
  Chat.start({
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    startedBy: LEON,
    harness: HarnessId.of('claude-code'),
    body: ChatMessageBody.fromInput('Improve this station.'),
    targetStation: IMPLEMENTATION,
    now: NOW,
    newId: () => 'chat_1',
  });

const IMPLEMENTATION = TargetStation.rehydrate({
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  lineKey: LineKey.of('delivery'),
  lineName: LineName.of('Delivery'),
  stationId: StationId.of('station_1'),
  stationKey: StationKey.of('implementation'),
  stationName: StationName.of('Implementation'),
});

describe('ChatBriefing', () => {
  it('briefs a chat that targets a station to read its history first, and to propose Terraform', () => {
    const briefed = brief(targetStationChat(), [], null, [DELIVERY]);

    expect(briefed).toContain('## Improving a station');
    expect(briefed).toContain('the Building station');
    expect(briefed).toContain(
      'spotlight history --line delivery --station implementation --last 30',
    );
    expect(briefed).toContain('Propose one change at a time');
    expect(briefed).toContain('prompts/<team>/delivery/implementation.md');
  });

  it('tells the agent when the station it was to improve is gone', () => {
    const briefed = brief(targetStationChat());

    expect(briefed).toContain('no longer on the team');
    expect(briefed).not.toContain('spotlight history');
  });

  it('says nothing of a target station where none was shared', () => {
    expect(brief(started())).not.toContain('spotlight history');
  });

  it('names the command for each shared trace, and how to read one', () => {
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

  it('follows up with the messages sent since the last run', () => {
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

  it('briefs a fresh chat with what the team has learned', () => {
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

  it('points a chat at the memory folder, without the line or station, and never tells it to remember', () => {
    const briefing = brief(started(), [], {
      path: '.spotlight/memory',
      layout: [
        { folder: 'team/', level: 'the whole team' },
        {
          folder: 'repositories/<owner>/<name>/<path>/',
          level: 'a repository, or a file or folder in it',
        },
      ],
      repositoryFolder: 'repositories/',
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
      body: ChatMessageBody.fromInput('Set up our configuration.'),
      setup: ConfigFolder.of({ repository: 'acme/infra', folder: 'spotlight' }),
      now: NOW,
      newId: () => 'chat_1',
    });

    it('requests a pull request with the team’s Terraform, never an apply', () => {
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
      expect(briefing).toContain('spotlight tools call setup-pull-request');
      expect(briefing).toContain(
        '"$SPOTLIGHT_URL/api/resources/workspaces/ws_1/export"',
      );
      expect(briefing).toContain('terraform plan');
    });

    it('offers Spotlight’s state backend, and signs in to it with the run’s token', () => {
      const briefing = brief(setup);

      expect(briefing).toContain('recommend that Spotlight keeps the state');
      expect(briefing).toContain(
        '"$SPOTLIGHT_URL/api/resources/workspaces/ws_1"',
      );
      expect(briefing).toContain(
        'address        = "https://app.usespotlight.ai/api/terraform/workspaces/<slug>/states/default"',
      );
      expect(briefing).toContain(
        'lock_address   = "https://app.usespotlight.ai/api/terraform/workspaces/<slug>/states/default/lock"',
      );
      expect(briefing).toContain('username       = "spotlight"');
      expect(briefing).toContain('TF_HTTP_PASSWORD=$(spotlight token)');
      expect(briefing).toContain(
        'export TF_HTTP_PASSWORD=$SPOTLIGHT_API_TOKEN',
      );
    });

    it('leads the team to own what it ships in production', () => {
      const briefing = brief(setup);

      expect(briefing).toContain('### 5. Connect operations');
      expect(briefing).toContain('Always talk about operations.');
      expect(briefing).toContain('`events[].raise.opens`');
      expect(briefing).toContain(
        'Do not connect a tool that the team does not use.',
      );
    });

    it('warns when the configuration’s repository is all it can read', () => {
      expect(brief(setup)).toContain(
        'Only `acme/infra` is checked out. If the team’s code is in other repositories, you cannot read it in this chat.',
      );
    });

    it('does not warn when the team’s repositories are checked out too', () => {
      const reading = Chat.start({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        startedBy: LEON,
        harness: HarnessId.of('claude-code'),
        body: ChatMessageBody.fromInput('Set up our configuration.'),
        repositories: [Repository.of('acme/api')],
        setup: ConfigFolder.of({
          repository: 'acme/infra',
          folder: 'spotlight',
        }),
        now: NOW,
        newId: () => 'chat_1',
      });

      expect(brief(reading)).not.toContain(
        'is checked out. If the team’s code',
      );
    });

    const withCi = (ci: Partial<Parameters<typeof CiSetup.of>[0]> = {}) =>
      Chat.start({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        startedBy: LEON,
        harness: HarnessId.of('claude-code'),
        body: ChatMessageBody.fromInput('Set up our configuration.'),
        setup: ConfigFolder.of({
          repository: 'acme/infra',
          folder: 'spotlight',
        }).withCi(
          CiSetup.of({
            defaultBranch: 'main',
            defaultBranchProtected: true,
            pullRequestsTrustId: 'trust_plan',
            defaultBranchTrustId: 'trust_apply',
            variables: 'written',
            ...ci,
          }),
        ),
        now: NOW,
        newId: () => 'chat_1',
      });

    it('adds a workflow that plans pull requests and applies the default branch through the trusts', () => {
      const briefing = brief(withCi());

      expect(briefing).toContain('### 7. Run Terraform in GitHub Actions');
      expect(briefing).toContain('`github-pull-requests` (`trust_plan`)');
      expect(briefing).toContain(
        '`github-apply` (`trust_apply`): a push to `main` may apply',
      );
      expect(briefing).toContain('.github/workflows/spotlight.yml');
      expect(briefing).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax
        'SPOTLIGHT_OIDC_TRUST: ${{ vars.SPOTLIGHT_PLAN_TRUST }}',
      );
      expect(briefing).toContain(
        // biome-ignore lint/suspicious/noTemplateCurlyInString: GitHub Actions expression syntax
        'SPOTLIGHT_OIDC_TRUST: ${{ vars.SPOTLIGHT_APPLY_TRUST }}',
      );
      expect(briefing).toContain('working-directory: spotlight');
      expect(briefing).toContain('### 8. Open the pull request');
      expect(briefing).toContain('Spotlight set the repository variables');
    });

    it('asks the person to add the variables when the GitHub App may not', () => {
      expect(brief(withCi({ variables: 'not-permitted' }))).toContain(
        '`SPOTLIGHT_PLAN_TRUST` = `trust_plan`, `SPOTLIGHT_APPLY_TRUST` = `trust_apply`',
      );
    });

    it('warns first when the default branch has no protection', () => {
      expect(brief(withCi({ defaultBranchProtected: false }))).toContain(
        '`main` has no branch protection. Anyone who can push to `main` can change',
      );
      expect(brief(withCi())).not.toContain('has no branch protection');
    });

    it('leaves CI out of a setup that has none', () => {
      expect(brief(setup)).not.toContain('Run Terraform in GitHub Actions');
      expect(brief(setup)).toContain('### 7. Open the pull request');
    });

    it('checks out the configuration’s repository', () => {
      expect(setup.repositories.map((each) => each.value)).toEqual([
        'acme/infra',
      ]);
    });
  });
});
