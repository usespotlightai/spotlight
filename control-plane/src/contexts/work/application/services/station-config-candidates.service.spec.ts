import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ToolDeclaration } from '@work/application/contracts/tools.contract';
import type { CandidateLines } from '@work/application/services/candidate-lines.service';
import { StationConfigCandidates } from '@work/application/services/station-config-candidates.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { describe, expect, it } from 'vitest';

const BUILD = StationId.of('station_build');

const lineWith = (tools: readonly Tool[]): LineMap =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of('station_backlog'),
        key: StationKey.of('backlog'),
        name: StationName.of('backlog'),
        position: 0,
        kind: 'backlog',
      }),
      stationOf({
        id: BUILD,
        key: StationKey.of('build'),
        name: StationName.of('build'),
        position: 1,
        tools,
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('completed'),
        position: 2,
        kind: 'completed',
      }),
    ],
  });

const configWith = (tools: readonly Tool[]): StationConfig =>
  StationConfig.rehydrate(
    {
      prompt: null,
      harness: 'dev',
      model: null,
      effort: null,
      profile: null,
      image: null,
      repositories: [],
      skills: [],
      tools: tools.map((each) => each.value),
      decisions: false,
      memories: false,
    },
    'f'.repeat(64),
  );

const declaration = (
  tool: string,
  readOnly: boolean,
  approval: { because: string } | null = null,
): ToolDeclaration => ({
  tool,
  integrationName: tool.split('.')[0] ?? tool,
  description: `Uses ${tool}.`,
  inputs: [],
  approval,
  inferredOutput: null,
  readOnly,
});

const DECLARED: readonly ToolDeclaration[] = [
  declaration('linear.comment', false),
  declaration('linear.get-issue', true),
  declaration('sentry.get-latest-event', true),
  declaration('sentry.get-issue', true, { because: 'It reads private data.' }),
];

const trialToolsOf = async (
  stationTools: readonly Tool[],
  onAnyMark: readonly string[],
): Promise<readonly string[] | undefined> => {
  const line = lineWith(stationTools);
  const candidates = {
    live: async () => ({ line, station: line.stationAt(BUILD) as Station }),
    configOf: async () => configWith(stationTools),
  } as unknown as CandidateLines;
  const integrations = new TeamIntegrations({
    provided: async (_team, tools) =>
      DECLARED.filter((each) => tools.includes(each.tool)),
    toolsOnMarks: async () => [],
    toolsOnAnyMark: async () => onAnyMark,
  });

  return (
    await new StationConfigCandidates(candidates, integrations).live(
      'line_1',
      BUILD.value,
    )
  )?.config.trialTools;
};

describe('StationConfigCandidates', () => {
  it('names the integration tools a replay of the station can call: its own and those on any mark, that change nothing, sorted', async () => {
    expect(
      await trialToolsOf(
        [
          Tool.of('linear.get-issue'),
          Tool.of('linear.comment'),
          Tool.of('checks'),
          Tool.of('open-tasks'),
        ],
        ['sentry.get-latest-event', 'sentry.get-issue', 'linear.get-issue'],
      ),
    ).toEqual(['linear.get-issue', 'sentry.get-latest-event']);
  });

  it('names no tools for a station whose tools all change data', async () => {
    expect(await trialToolsOf([Tool.of('linear.comment')], [])).toEqual([]);
  });
});
