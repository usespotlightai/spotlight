import type {
  DependencyFacts,
  SecretCarrier,
  StationDependsOn,
} from '@replays/domain/value-objects/dependency-facts';
import type {
  Dependency,
  PlannedChanges,
} from '@replays/domain/value-objects/planned-changes.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

class StationReach {
  constructor(
    private readonly dependsOn: readonly StationDependsOn[],
    private readonly facts: DependencyFacts,
  ) {}

  harnessProfile(key: string): boolean {
    return this.dependsOn.some((each) => each.harnessProfile === key);
  }

  skill(key: string): boolean {
    return this.dependsOn.some((each) => each.skills.includes(key));
  }

  integration(key: string): boolean {
    return (
      this.dependsOn.some((each) =>
        each.tools.some((tool) => Tool.of(tool).integration === key),
      ) ||
      this.facts.hooks.some((hook) => hook.integrations.includes(key)) ||
      this.facts.onMarksAsPlanned.includes(key)
    );
  }

  hook(key: string): boolean {
    return this.facts.hooks.some((hook) => hook.key === key);
  }

  carrier(carrier: SecretCarrier, key: string): boolean {
    switch (carrier) {
      case 'harness-profile':
        return this.harnessProfile(key);
      case 'integration':
        return this.integration(key);
      case 'skill':
        return this.skill(key);
    }
  }
}

export const dependenciesChanged = (
  dependsOn: readonly StationDependsOn[],
  planned: PlannedChanges,
  facts: DependencyFacts,
): readonly Dependency[] => {
  const reach = new StationReach(dependsOn, facts);
  const keyed = (
    kind: Dependency['kind'],
    keys: readonly string[],
    reaches: (key: string) => boolean,
  ): Dependency[] => keys.filter(reaches).map((key) => ({ kind, key }));

  return [
    ...keyed('harness-profile', planned.harnessProfiles, (key) =>
      reach.harnessProfile(key),
    ),
    ...keyed('skill', planned.skills, (key) => reach.skill(key)),
    ...keyed(
      'integration',
      planned.integrations.map((each) => each.key),
      (key) => reach.integration(key),
    ),
    ...keyed(
      'hook',
      planned.hooks.map((each) => each.key),
      (key) => reach.hook(key),
    ),
    ...keyed(
      'secret',
      planned.secrets.map((each) => each.value),
      (name) =>
        facts.secrets.some(
          (each) =>
            each.secret.value === name && reach.carrier(each.carrier, each.key),
        ),
    ),
  ];
};
