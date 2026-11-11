import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface ToolRule {
  readonly tool: ToolName;
  readonly rule: PersonToolRule;
}

interface State {
  readonly teamId: TeamId;
  readonly personId: UserId;
  readonly integration: IntegrationKey;
  readonly rules: readonly ToolRule[];
  readonly version: number;
}

export class PersonToolPolicy {
  private constructor(private readonly state: State) {}

  static none(input: {
    teamId: TeamId;
    personId: UserId;
    integration: IntegrationKey;
  }): PersonToolPolicy {
    return new PersonToolPolicy({ ...input, rules: [], version: 0 });
  }

  static rehydrate(input: State): PersonToolPolicy {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'person tool policy',
        'was stored without a version',
      );
    }

    if (input.rules.some((each) => each.rule.allows)) {
      throw new InconsistentStateError(
        'person tool policy',
        'was stored with a rule that only allows, which it never stores',
      );
    }

    return new PersonToolPolicy(input);
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get personId(): UserId {
    return this.state.personId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get rules(): readonly ToolRule[] {
    return this.state.rules;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  ruleFor(tool: ToolName): PersonToolRule {
    return (
      this.state.rules.find((each) => each.tool.equals(tool))?.rule ??
      PersonToolRule.allowed()
    );
  }

  set(tool: ToolName, rule: PersonToolRule): PersonToolPolicy {
    if (!tool.integration.equals(this.state.integration)) {
      throw new InvalidIntegrationPartError(
        'tool rule',
        `names ${tool.value}, which ${this.state.integration.value} does not offer`,
      );
    }

    const others = this.state.rules.filter((each) => !each.tool.equals(tool));

    return new PersonToolPolicy({
      ...this.state,
      rules: rule.allows ? others : [...others, { tool, rule }],
    });
  }

  equals(other: PersonToolPolicy): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.personId.equals(other.personId) &&
      this.integration.equals(other.integration)
    );
  }
}
