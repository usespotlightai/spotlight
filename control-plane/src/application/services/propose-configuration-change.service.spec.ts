import type {
  LineConfigReaderPort,
  ReadLines,
} from '@application/ports/line-config-reader.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import { LINE_PROPOSAL_TITLE } from '@application/rendering/configuration-proposal';
import type {
  ConfigurationRepo,
  ConfigurationTarget,
} from '@application/services/configuration-target.service';
import type { PendingConfiguration } from '@application/services/pending-configuration.service';
import {
  type ConfigurationChange,
  type ProposalTarget,
  ProposeConfigurationChange,
} from '@application/services/propose-configuration-change.service';
import type {
  WriteConfiguration,
  Writing,
} from '@application/services/write-configuration.service';
import { Line } from '@domain/aggregates/line.aggregate';
import type { Team } from '@domain/aggregates/team.aggregate';
import { linePath } from '@domain/aggregates/team-configuration.aggregate';
import { Workspace } from '@domain/aggregates/workspace.aggregate';
import { Station } from '@domain/entities/station.entity';
import { PendingLineUnreadableError } from '@domain/exceptions/pending-line-unreadable.error';
import { UnknownLineError } from '@domain/exceptions/unknown-line.error';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { ConfigurationProblem } from '@domain/value-objects/configuration-problem.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { GitHubInstallation } from '@domain/value-objects/github-installation.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LinePlan } from '@domain/value-objects/line-plan.vo';
import { Repository } from '@domain/value-objects/repository.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { WorkspaceName } from '@domain/value-objects/workspace-name.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

const GREY = StationColor.of('#a3a8b0');
const TEAL = StationColor.of('#14b8a6');

const line = () =>
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
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

const WORKSPACE = Workspace.rehydrate({
  id: WorkspaceId.of('ws_1'),
  name: WorkspaceName.of('Acme'),
  slug: WorkspaceSlug.of('acme'),
  members: [{ userId: UserId.of('user_1'), role: WorkspaceRole.owner }],
  teams: [TeamId.of('team_1')],
});

const TEAM = {
  id: TeamId.of('team_1'),
  configRepository: Repository.of('acme/api'),
} as unknown as Team;

const INTO: ConfigurationRepo = {
  installation: GitHubInstallation.of('42'),
  repository: Repository.of('acme/api'),
};

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
  write: (each: Line) => {
    const text = `line ${writtenPlans.size + 1}`;
    writtenPlans.set(text, planOf(each));
    return ConfigurationFile.of(linePath(each.key.value), text);
  },
} satisfies LineConfigReaderPort;

interface Over {
  lines?: readonly Line[];
  branchFile?: ConfigurationFile | null;
  member?: boolean;
  workspace?: boolean;
  team?: boolean;
  into?: ConfigurationRepo | null;
  read?: (files: readonly ConfigurationFile[]) => ReadLines;
}

const proposing = (over: Over = {}) => {
  const written: { into: ConfigurationRepo; writing: Writing }[] = [];

  const members = {
    findTeamForMember: async () =>
      over.member === false
        ? null
        : {
            workspaceId: 'ws_1',
            teamId: 'team_1',
            teamKey: 'core',
            slug: 'acme',
          },
  } as unknown as WorkspaceReaderPort;

  const workspaces = {
    findBySlug: async () => (over.workspace === false ? null : WORKSPACE),
  } as unknown as WorkspaceRepository;

  const teams = {
    find: async () => (over.team === false ? null : TEAM),
  } as unknown as TeamRepository;

  const lines = {
    ofTeam: async () => over.lines ?? [line()],
  } as unknown as LineRepository;

  const reader = {
    read: over.read ?? ((files) => fileReader.read(files)),
    write: (each: Line) => fileReader.write(each),
  } satisfies LineConfigReaderPort;

  const target = {
    of: async () => (over.into === undefined ? INTO : over.into),
  } as unknown as ConfigurationTarget;

  const writing = {
    writeInto: async (into: ConfigurationRepo, asked: Writing) => {
      written.push({ into, writing: asked });
      return { url: 'https://github.com/acme/api/pull/9' };
    },
  } as unknown as WriteConfiguration;

  const pending = {
    onBranch: async (_into: ConfigurationRepo, path: string) =>
      over.branchFile && over.branchFile.path === path ? over.branchFile : null,
  } as unknown as PendingConfiguration;

  let generated = 0;
  const service = new ProposeConfigurationChange(
    workspaces,
    members,
    teams,
    lines,
    reader,
    target,
    writing,
    pending,
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

const configurationChange = (
  over: Partial<ConfigurationChange> = {},
): ConfigurationChange => ({
  teamId: 'team_1',
  viewerId: 'user_1',
  title: 'Listen to Sentry',
  body: 'Sentry, written down.',
  written: async () => ({
    files: [ConfigurationFile.of('.spotlight/integrations/sentry.yml', 'x')],
  }),
  ...over,
});

describe('ProposeConfigurationChange', () => {
  describe('a line edit', () => {
    it('writes the edited line to the configuration repository as a pull request', async () => {
      const { service, written } = proposing();

      await expect(service.proposeLine(lineChange())).resolves.toEqual({
        url: 'https://github.com/acme/api/pull/9',
      });
      expect(written).toHaveLength(1);
      expect(written[0]?.into).toEqual(INTO);
      expect(written[0]?.writing.title).toBe(LINE_PROPOSAL_TITLE);
      expect(written[0]?.writing.body).toContain(
        'Changes to the Intake station.',
      );
      expect(written[0]?.writing.files.map((each) => each.path)).toEqual([
        '.spotlight/lines/default.yml',
      ]);
      expect(
        stationPlanned(renderedLine(written[0]?.writing.files[0]), 'triage')
          ?.name.value,
      ).toBe('Intake');
    });

    it('lands the edit on the line as the open pull request already has it', async () => {
      const onBranch = fileReader.write(
        line().renameStation(
          StationId.of('station_1'),
          StationName.of('Intake'),
        ),
      );
      const { service, written } = proposing({ branchFile: onBranch });

      await service.proposeLine(
        lineChange((base) =>
          base.repaintStation(StationId.of('station_1'), TEAL),
        ),
      );

      const triage = stationPlanned(
        renderedLine(written[0]?.writing.files[0]),
        'triage',
      );
      expect(triage?.name.value).toBe('Intake');
      expect(triage?.color.value).toBe(TEAL.value);
    });

    it('edits the line as Spotlight holds it where the branch has no copy of it', async () => {
      const { service, written } = proposing({ branchFile: null });

      await service.proposeLine(
        lineChange((base) =>
          base.repaintStation(StationId.of('station_1'), TEAL),
        ),
      );

      const triage = stationPlanned(
        renderedLine(written[0]?.writing.files[0]),
        'triage',
      );
      expect(triage?.name.value).toBe('Triage');
      expect(triage?.color.value).toBe(TEAL.value);
    });

    it('refuses, and writes nothing, where the branch’s copy of the line does not read', async () => {
      const { service, written } = proposing({
        branchFile: ConfigurationFile.of(
          '.spotlight/lines/default.yml',
          'not: [a line',
        ),
        read: () => ({
          plans: [],
          problems: [
            ConfigurationProblem.of({
              path: '.spotlight/lines/default.yml',
              at: 'the file',
              reason: 'is not YAML',
            }),
          ],
        }),
      });

      await expect(service.proposeLine(lineChange())).rejects.toThrow(
        PendingLineUnreadableError,
      );
      expect(written).toEqual([]);
    });

    it('refuses, and writes nothing, where the branch’s copy cannot be made into the line', async () => {
      const { service, written } = proposing({
        branchFile: ConfigurationFile.of('.spotlight/lines/default.yml', 'x'),
        read: () => ({
          plans: [
            {
              ...renderedLine(fileReader.write(line())),
              stations: [],
            } as unknown as LinePlan,
          ],
          problems: [],
        }),
      });

      await expect(service.proposeLine(lineChange())).rejects.toThrow(
        PendingLineUnreadableError,
      );
      expect(written).toEqual([]);
    });

    it('refuses where the line does not exist, or another team runs it', async () => {
      await expect(
        proposing({ lines: [] }).service.proposeLine(lineChange()),
      ).rejects.toThrow(UnknownLineError);
    });

    it('says nothing, and writes nothing, where the caller may not propose', async () => {
      for (const over of [
        { member: false },
        { workspace: false },
        { team: false },
      ] satisfies Over[]) {
        const { service, written } = proposing(over);

        await expect(service.proposeLine(lineChange())).resolves.toBeNull();
        expect(written).toEqual([]);
      }

      const { service, written } = proposing();
      await expect(
        service.proposeLine(lineChange(undefined, 'user_2')),
      ).resolves.toBeNull();
      expect(written).toEqual([]);
    });

    it('says nothing, and writes nothing, where the team keeps no configuration repository', async () => {
      const { service, written } = proposing({ into: null });

      await expect(service.proposeLine(lineChange())).resolves.toBeNull();
      expect(written).toEqual([]);
    });
  });

  describe('any other change', () => {
    it('writes what the change writes, where the team keeps its configuration', async () => {
      const { service, written } = proposing();
      let targeted: ProposalTarget | undefined;

      await expect(
        service.propose(
          configurationChange({
            written: async (target) => {
              targeted = target;
              return {
                files: [
                  ConfigurationFile.of(
                    '.spotlight/integrations/sentry.yml',
                    'x',
                  ),
                ],
              };
            },
          }),
        ),
      ).resolves.toEqual({ url: 'https://github.com/acme/api/pull/9' });

      expect(targeted).toEqual({
        workspace: WORKSPACE,
        team: TEAM,
        into: INTO,
      });
      expect(written).toEqual([
        {
          into: INTO,
          writing: {
            title: 'Listen to Sentry',
            body: 'Sentry, written down.',
            files: [
              ConfigurationFile.of('.spotlight/integrations/sentry.yml', 'x'),
            ],
          },
        },
      ]);
    });

    it('writes a change that only takes files away', async () => {
      const { service, written } = proposing();

      await service.propose(
        configurationChange({
          written: async () => ({
            files: [],
            removes: ['.spotlight/integrations/linear.yml'],
          }),
        }),
      );

      expect(written[0]?.writing.removes).toEqual([
        '.spotlight/integrations/linear.yml',
      ]);
    });

    it('says nothing, and writes nothing, where the change writes nothing', async () => {
      const { service, written } = proposing();

      await expect(
        service.propose(
          configurationChange({ written: async () => ({ files: [] }) }),
        ),
      ).resolves.toBeNull();
      expect(written).toEqual([]);
    });

    it('says nothing, and writes nothing, where the caller may not propose', async () => {
      for (const over of [
        { member: false },
        { workspace: false },
        { team: false },
      ] satisfies Over[]) {
        const { service, written } = proposing(over);

        await expect(
          service.propose(configurationChange()),
        ).resolves.toBeNull();
        expect(written).toEqual([]);
      }

      const { service, written } = proposing();
      await expect(
        service.propose(configurationChange({ viewerId: 'user_2' })),
      ).resolves.toBeNull();
      expect(written).toEqual([]);
    });

    it('says nothing, and writes nothing, where the team keeps no configuration repository', async () => {
      const { service, written } = proposing({ into: null });

      await expect(service.propose(configurationChange())).resolves.toBeNull();
      expect(written).toEqual([]);
    });
  });
});
