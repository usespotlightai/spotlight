import type {
  HookAtStation,
  HookConfig,
  HookConfigStep,
  HookConfigsPort,
  HookStation,
  PlannedHookMatch,
} from '@configuration/application/ports/hook-configs.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  HookRecord,
  HookResourcesPort,
  WrittenHookStep,
} from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { mayFireAtStation } from '@integrations/domain/value-objects/hook-match.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

const stepOf = (step: WrittenHookStep): HookConfigStep =>
  'call' in step
    ? { name: step.name, call: step.call, with: { ...step.with } }
    : {
        name: step.name,
        request: { ...step.request, headers: { ...step.request.headers } },
      };

const integrationsCalledBy = (
  steps: readonly WrittenHookStep[],
): readonly string[] => [
  ...new Set(
    steps.flatMap((step) => {
      const integration =
        'call' in step ? Tool.of(step.call).integration : null;

      return integration !== null && integration !== '' ? [integration] : [];
    }),
  ),
];

const configOf = (teamKey: string, record: HookRecord): HookConfig => {
  const { written } = record;

  return {
    id: record.id,
    address: HookAddress.of(teamKey, HookKey.of(record.key)).toString(),
    teamId: record.teamId,
    key: record.key,
    on: written.on,
    match: {
      tools: [...written.match.tools],
      lines: [...written.match.lines],
      stations: [...written.match.stations],
      repositories: [...written.match.repositories],
      paths: [...written.match.paths],
    },
    when: written.when,
    vars: { ...written.vars },
    steps: written.steps.map(stepOf),
    signing: written.signing,
    failure: written.failure,
    timeoutSeconds: written.timeoutSeconds,
  };
};

export class HookConfigs implements HookConfigsPort {
  constructor(
    private readonly resources: HookResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<HookConfig | null> {
    const record = await this.resources.withId(HookDefinitionId.of(id));
    const team = record && (await this.teams.find(record.teamId));

    return record && team ? configOf(team.key, record) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly HookConfig[]> {
    const team = await this.teams.find(teamId);

    return team
      ? (await this.resources.ofTeam(teamId)).map((each) =>
          configOf(team.key, each),
        )
      : [];
  }

  async mayFireAt(
    teamId: TeamId,
    station: HookStation,
    planned: readonly PlannedHookMatch[],
  ): Promise<readonly HookAtStation[]> {
    const fires = (match: PlannedHookMatch | HookRecord['written']['match']) =>
      mayFireAtStation(match, station.lineKey, station.stationKey);
    const records = await this.resources.ofTeam(teamId);
    const live = records
      .filter(
        (record) =>
          fires(record.written.match) ||
          planned.some((each) => each.key === record.key && fires(each)),
      )
      .map((record) => ({
        key: record.key,
        integrations: integrationsCalledBy(record.written.steps),
      }));
    const added = planned
      .filter(
        (each) =>
          fires(each) && !records.some((record) => record.key === each.key),
      )
      .map((each) => ({ key: each.key, integrations: [] }));

    return [...live, ...added];
  }
}
