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
import {
  type WrittenHook,
  writtenHookOf,
} from '@integrations/infrastructure/hooks/hook.compile';
import type { HookStepFile } from '@integrations/infrastructure/hooks/hook.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const stepOf = (step: HookStepFile): HookConfigStep => {
  if (step.call !== undefined) {
    return { name: step.name, call: step.call, with: { ...step.with } };
  }

  const request = step.request as NonNullable<HookStepFile['request']>;

  return {
    name: step.name,
    request: {
      url: request.url,
      headers: { ...request.headers },
      body: request.body,
      from: request.from ?? null,
    },
  };
};

const signingOf = (
  signing: WrittenHook['signing'],
): HookConfigSigning | null => {
  if (!signing) {
    return null;
  }

  return 'oidc' in signing
    ? { oidc: { audience: signing.oidc.audience } }
    : { secretVersion: signing.secretVersion };
};

const configOf = (teamKey: string, record: HookRecord): HookConfig => {
  const written = writtenHookOf(record.definition);

  if (!written) {
    throw new InconsistentStateError(
      'hook',
      `${record.key} is stored in a form no hook is written in`,
    );
  }

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
    when: written.when ?? null,
    vars: { ...written.vars },
    steps: written.steps.map(stepOf),
    signing: signingOf(written.signing),
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
