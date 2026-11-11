import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type {
  HookResourceDto,
  HookStepView,
} from '@integrations/application/dto/hook-resource.dto';
import type {
  HookRecord,
  WrittenHookStep,
} from '@integrations/application/ports/hook-resources.port';
import { HookAddress } from '@integrations/domain/value-objects/hook-address.vo';
import { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import { Hook } from '@integrations/domain/value-objects/hook.vo';

const stepView = (step: WrittenHookStep): HookStepView =>
  'call' in step
    ? step
    : {
        name: step.name,
        request: {
          ...step.request,
          from: step.request.from ?? Hook.DEFAULTS.from,
        },
      };

export class HookViews {
  constructor(private readonly teams: TeamDirectoryPort) {}

  async of(record: HookRecord): Promise<HookResourceDto | null> {
    const team = await this.teams.find(record.teamId);

    return team ? this.onTeam(record, team.key) : null;
  }

  onTeam(record: HookRecord, teamKey: string): HookResourceDto {
    const { written } = record;

    return {
      id: record.id,
      version: record.version,
      address: HookAddress.of(teamKey, HookKey.of(record.key)).toString(),
      teamId: record.teamId.value,
      key: record.key,
      on: written.on,
      match: written.match,
      when: written.when,
      vars: written.vars,
      steps: written.steps.map(stepView),
      signing: written.signing,
      failure: written.failure ?? Hook.DEFAULTS.failure,
      timeoutSeconds: written.timeoutSeconds ?? Hook.DEFAULTS.timeoutSeconds,
      warnings: [],
    };
  }
}
