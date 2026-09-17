import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  linePath,
  stationPath,
} from '@work/application/contracts/line-layout.contract';
import type {
  ConfigurationProposalsPort,
  Proposal,
} from '@work/application/ports/configuration-proposals.port';
import type {
  LineConfigReaderPort,
  ReadLines,
} from '@work/application/ports/line-config-reader.port';
import type { LineConfigWriterPort } from '@work/application/ports/line-config-writer.port';
import { LINE_PROPOSAL_TITLE } from '@work/application/rendering/configuration-proposal';
import { ProposeLineChange } from '@work/application/services/propose-line-change.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { PendingLineUnreadableError } from '@work/domain/exceptions/pending-line-unreadable.error';
import { UnknownLineError } from '@work/domain/exceptions/unknown-line.error';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it, vi } from 'vitest';

const GREY = StationColor.of('#a3a8b0');
const TEAL = StationColor.of('#14b8a6');

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      Station.of({
        id: StationId.of('station_0'),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: GREY,
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('triage'),
        name: StationName.of('Triage'),
        position: 1,
        color: GREY,
      }),
      Station.of({
        id: StationId.of('station_2'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 2,
        color: GREY,
        kind: 'completed',
      }),
    ],
  });

const planOf = (each: Line): LinePlan => {
  const keyOf = new Map(
    each.stations.map((station) => [station.id.value, station.key]),
  );

  return LinePlan.of({
    key: each.key,
    name: each.name,
    role: each.role,
    stations: each.stations.map((station) => ({
      key: station.key,
      name: station.name,
      kind: station.kind,
      color: station.color,
      description: station.description,
      harness: station.harness,
      model: station.model,
      effort: station.effort,
      agentPrompt: station.agentPrompt,
      check: null,
      tools: station.tools,
      skills: station.skills,
      passesTo: station.wayOut.stations.map(
        (to) => keyOf.get(to.value) as StationKey,
      ),
      ends: station.wayOut.ends,
    })),
  });
};

const writtenPlans = new Map<string, LinePlan>();

const fileReader = {
  read: (files: readonly ConfigurationFile[]): ReadLines => ({
    plans: files.flatMap((file) => {
      const plan = writtenPlans.get(file.text);
      return plan ? [plan] : [];
    }),
    problems: [],
  }),
  write: (each: Line, over: readonly ConfigurationFile[] = []) => {
    const text = `line ${writtenPlans.size + 1}`;
    writtenPlans.set(text, planOf(each));
    const files = [
      ConfigurationFile.of(linePath(each.key.value), text),
      ...each.stations.map((station) =>
        ConfigurationFile.of(
          stationPath(each.key.value, station.key.value),
          station.name.value,
        ),
      ),
    ];
    const writing = new Set(files.map((file) => file.path));

    return {
      files,
      removes: over
        .filter((file) => !writing.has(file.path))
        .map((file) => file.path),
    };
  },
} satisfies LineConfigReaderPort & LineConfigWriterPort;

interface Over {
  lines?: readonly Line[];
  held?: { onBranch: boolean; files: readonly ConfigurationFile[] };
  member?: boolean;
  nowhere?: boolean;
  read?: (files: readonly ConfigurationFile[]) => ReadLines;
}

const proposing = (over: Over = {}) => {
  const written: { teamId: TeamId; proposal: Proposal }[] = [];

  const access = {
    viewableBy: vi.fn(),
    mayView: vi.fn(),
    inWorkspace: vi.fn(),
    onTeam: vi.fn(async () =>
      over.member === false
        ? null
        : {
            workspaceId: WorkspaceId.of('ws_1'),
            slug: 'acme',
            viewer: UserId.of('user_1'),
            teamId: TeamId.of('team_1'),
            administers: true,
          },
    ),
  } satisfies WorkspaceAccessPort;

  const lines = {
    ofTeam: async () => over.lines ?? [line()],
  } as unknown as LineRepository;

  const reader = {
    read: over.read ?? ((files) => fileReader.read(files)),
  } satisfies LineConfigReaderPort;

  const writer = {
    write: (each: Line, standing?: readonly ConfigurationFile[]) =>
      fileReader.write(each, standing),
  } satisfies LineConfigWriterPort;

  const proposals: ConfigurationProposalsPort = {
    pendingUnder: async (_teamId, path) =>
      over.nowhere
        ? null
        : {
            onBranch: over.held?.onBranch ?? false,
            files: (over.held?.files ?? []).filter((each) =>
              each.isUnder(path),
            ),
          },
    propose: async (teamId, proposal) => {
      written.push({ teamId, proposal });
      return { url: 'https://github.com/acme/api/pull/9' };
    },
    seed: async () => null,
  };

  let generated = 0;
  const service = new ProposeLineChange(
    access,
    lines,
    reader,
    writer,
    proposals,
    { generate: () => `id_${++generated}` },
  );

  return { service, written };
};

const renderedLine = (file: ConfigurationFile | undefined) => {
  const [plan] = fileReader.read(file ? [file] : []).plans;
  return plan;
};

const stationPlanned = (plan: LinePlan | undefined, key: string) =>
  plan?.stations.find((each) => each.key.value === key);

const lineChange = (
  change: (base: Line) => Line = (base) =>
    base.renameStation(StationId.of('station_1'), StationName.of('Intake')),
  viewerId = 'user_1',
) => ({
  teamId: 'team_1',
  viewerId,
  lineId: 'line_1',
  change,
  describe: (edited: Line) =>
    `Changes to the ${edited.stationAt(StationId.of('station_1'))?.name.value} station.`,
});

describe('ProposeLineChange', () => {
  it('writes the edited line to the configuration repository as a pull request', async () => {
    const { service, written } = proposing();

    await expect(service.propose(lineChange())).resolves.toEqual({
      url: 'https://github.com/acme/api/pull/9',
    });
    expect(written).toHaveLength(1);
    expect(written[0]?.teamId).toEqual(TeamId.of('team_1'));
    expect(written[0]?.proposal.title).toBe(LINE_PROPOSAL_TITLE);
    expect(written[0]?.proposal.body).toContain(
      'Changes to the Intake station.',
    );
    expect(written[0]?.proposal.files.map((each) => each.path)).toEqual([
      '.spotlight/lines/default/line.yml',
      '.spotlight/lines/default/stations/backlog.md',
      '.spotlight/lines/default/stations/triage.md',
      '.spotlight/lines/default/stations/completed.md',
    ]);
    expect(written[0]?.proposal.removes).toEqual([]);
    expect(
      stationPlanned(renderedLine(written[0]?.proposal.files[0]), 'triage')
        ?.name.value,
    ).toBe('Intake');
  });

  it('lands the edit on the line as the open pull request already has it', async () => {
    const onBranch = fileReader.write(
      line().renameStation(StationId.of('station_1'), StationName.of('Intake')),
    );
    const { service, written } = proposing({
      held: { onBranch: true, files: onBranch.files },
    });

    await service.propose(
      lineChange((base) =>
        base.repaintStation(StationId.of('station_1'), TEAL),
      ),
    );

    const triage = stationPlanned(
      renderedLine(written[0]?.proposal.files[0]),
      'triage',
    );
    expect(triage?.name.value).toBe('Intake');
    expect(triage?.color.value).toBe(TEAL.value);
  });

  it('edits the line as Spotlight holds it where the branch has no copy of it', async () => {
    const { service, written } = proposing({
      held: {
        onBranch: true,
        files: fileReader
          .write(line())
          .files.map((each) =>
            ConfigurationFile.of(
              each.path.replace('/default/', '/another/'),
              each.text,
            ),
          ),
      },
    });

    await service.propose(
      lineChange((base) =>
        base.repaintStation(StationId.of('station_1'), TEAL),
      ),
    );

    const triage = stationPlanned(
      renderedLine(written[0]?.proposal.files[0]),
      'triage',
    );
    expect(triage?.name.value).toBe('Triage');
    expect(triage?.color.value).toBe(TEAL.value);
  });

  it('refuses, and writes nothing, where the branch’s copy of the line does not read', async () => {
    const { service, written } = proposing({
      held: {
        onBranch: true,
        files: [
          ConfigurationFile.of(
            '.spotlight/lines/default/line.yml',
            'not: [a line',
          ),
        ],
      },
      read: () => ({
        plans: [],
        problems: [
          ConfigurationProblem.of({
            path: '.spotlight/lines/default/line.yml',
            at: 'the file',
            reason: 'is not YAML',
          }),
        ],
      }),
    });

    await expect(service.propose(lineChange())).rejects.toThrow(
      PendingLineUnreadableError,
    );
    expect(written).toEqual([]);
  });

  it('refuses, and writes nothing, where the branch’s copy cannot be made into the line', async () => {
    const { service, written } = proposing({
      held: {
        onBranch: true,
        files: [ConfigurationFile.of('.spotlight/lines/default/line.yml', 'x')],
      },
      read: () => ({
        plans: [
          {
            ...renderedLine(fileReader.write(line()).files[0]),
            stations: [],
          } as unknown as LinePlan,
        ],
        problems: [],
      }),
    });

    await expect(service.propose(lineChange())).rejects.toThrow(
      PendingLineUnreadableError,
    );
    expect(written).toEqual([]);
  });

  it('edits the line as Spotlight holds it where no pull request is open', async () => {
    const onHead = fileReader.write(
      line().renameStation(StationId.of('station_1'), StationName.of('Intake')),
    );
    const { service, written } = proposing({
      held: { onBranch: false, files: onHead.files },
    });

    await service.propose(
      lineChange((base) =>
        base.repaintStation(StationId.of('station_1'), TEAL),
      ),
    );

    expect(
      stationPlanned(renderedLine(written[0]?.proposal.files[0]), 'triage')
        ?.name.value,
    ).toBe('Triage');
  });

  it('takes away what writing the line leaves behind in its folder', async () => {
    const { service, written } = proposing({
      held: {
        onBranch: false,
        files: [
          ConfigurationFile.of('.spotlight/lines/default/line.yml', 'x'),
          ConfigurationFile.of(
            '.spotlight/lines/default/stations/triage.md',
            'x',
          ),
          ConfigurationFile.of(
            '.spotlight/lines/default/stations/gone.md',
            'x',
          ),
          ConfigurationFile.of('.spotlight/lines/default/README.md', 'x'),
          ConfigurationFile.of('.spotlight/lines/other/stations/gone.md', 'x'),
        ],
      },
    });

    await service.propose(lineChange());

    expect(written[0]?.proposal.removes).toEqual([
      '.spotlight/lines/default/stations/gone.md',
      '.spotlight/lines/default/README.md',
    ]);
  });

  it('refuses where the line does not exist, or another team runs it', async () => {
    await expect(
      proposing({ lines: [] }).service.propose(lineChange()),
    ).rejects.toThrow(UnknownLineError);
  });

  it('says nothing, and writes nothing, where the caller may not propose', async () => {
    const { service, written } = proposing({ member: false });

    await expect(service.propose(lineChange())).resolves.toBeNull();
    expect(written).toEqual([]);
  });

  it('says nothing, and writes nothing, where the team keeps no configuration repository', async () => {
    const { service, written } = proposing({ nowhere: true });

    await expect(service.propose(lineChange())).resolves.toBeNull();
    expect(written).toEqual([]);
  });
});
