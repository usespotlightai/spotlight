import type {
  HookConfig,
  HookConfigSigning,
  HookConfigStep,
  HookConfigsPort,
} from '@configuration/application/ports/hook-configs.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  HookRecord,
  HookResourcesPort,
} from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

type Fields = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Fields =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const fieldsIn = (value: unknown): Fields => (isRecord(value) ? value : {});

const textsIn = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.map(String) : [];

const textsBy = (value: unknown): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(fieldsIn(value)).map(([name, each]) => [name, String(each)]),
  );

const stepOf = (step: Fields): HookConfigStep => {
  const name = String(step.name ?? '');

  if (typeof step.call === 'string') {
    return { name, call: step.call, with: { ...fieldsIn(step.with) } };
  }

  const request = fieldsIn(step.request);

  return {
    name,
    request: {
      url: String(request.url ?? ''),
      headers: textsBy(request.headers),
      body: request.body,
      from: request.from === 'network' ? 'network' : 'spotlight',
    },
  };
};

const signingOf = (value: unknown): HookConfigSigning | null => {
  const signing = fieldsIn(value);

  if (isRecord(signing.oidc)) {
    return { oidc: { audience: String(signing.oidc.audience ?? '') } };
  }

  return typeof signing.secretVersion === 'number'
    ? { secretVersion: signing.secretVersion }
    : null;
};

const configOf = (teamKey: string, record: HookRecord): HookConfig => {
  const definition = record.definition;
  const match = fieldsIn(definition.match);

  return {
    id: record.id,
    address: HookAddress.of(teamKey, HookKey.of(record.key)).toString(),
    teamId: record.teamId,
    key: record.key,
    on: String(definition.on ?? ''),
    match: {
      tools: textsIn(match.tools),
      lines: textsIn(match.lines),
      stations: textsIn(match.stations),
      repositories: textsIn(match.repositories),
      paths: textsIn(match.paths),
    },
    when: typeof definition.when === 'string' ? definition.when : null,
    vars: textsBy(definition.vars),
    steps: (Array.isArray(definition.steps) ? definition.steps : [])
      .filter(isRecord)
      .map(stepOf),
    signing: signingOf(definition.signing),
    failure: typeof definition.failure === 'string' ? definition.failure : null,
    timeoutSeconds:
      typeof definition.timeoutSeconds === 'number'
        ? definition.timeoutSeconds
        : null,
  };
};

export class HookConfigs implements HookConfigsPort {
  constructor(
    private readonly resources: HookResourcesPort,
    private readonly teams: TeamDirectoryPort,
  ) {}

  async withId(id: string): Promise<HookConfig | null> {
    const record = await this.resources.withId(id);
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
}
