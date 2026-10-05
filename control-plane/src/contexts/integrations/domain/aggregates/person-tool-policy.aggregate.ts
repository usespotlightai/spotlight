import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly personId: UserId;
  readonly source: SourceKey;
  readonly rules: ReadonlyMap<string, PersonToolRule>;
  readonly version: number;
}

export class PersonToolPolicy {
  private constructor(private readonly state: State) {}

  static none(input: {
    teamId: TeamId;
    personId: UserId;
    source: SourceKey;
  }): PersonToolPolicy {
    return new PersonToolPolicy({ ...input, rules: new Map(), version: 0 });
  }

  static rehydrate(input: State): PersonToolPolicy {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'person tool policy',
        'was kept without a version',
      );
    }

    if ([...input.rules.values()].some((each) => each.allows)) {
      throw new InconsistentStateError(
        'person tool policy',
        'was kept with a rule that only allows, which it never keeps',
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

  get source(): SourceKey {
    return this.state.source;
  }

  get rules(): ReadonlyMap<string, PersonToolRule> {
    return this.state.rules;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  ruleFor(tool: ToolName): PersonToolRule {
    return this.state.rules.get(tool.value) ?? PersonToolRule.allowed();
  }

  set(tool: ToolName, rule: PersonToolRule): PersonToolPolicy {
    if (!tool.value.startsWith(`${this.state.source.value}.`)) {
      throw new InvalidIntegrationPartError(
        'tool rule',
        `names ${tool.value}, which ${this.state.source.value} does not offer`,
      );
    }

    const rules = new Map(this.state.rules);

    if (rule.allows) {
      rules.delete(tool.value);
    } else {
      rules.set(tool.value, rule);
    }

    return new PersonToolPolicy({ ...this.state, rules });
  }

  equals(other: PersonToolPolicy): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.personId.equals(other.personId) &&
      this.source.equals(other.source)
    );
  }
}
