import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';

export interface EnabledIntegration {
  readonly integration: IntegrationName;
  readonly name: string;
  readonly tools: number;
}

export const enabledIntegrations = (
  described: readonly DeclaredTool[],
): EnabledIntegration[] => {
  const counted = new Map<string, EnabledIntegration>();

  for (const each of described) {
    if (each.tool.integration === null) {
      continue;
    }

    const integration = IntegrationName.of(each.tool.integration);
    const existing = counted.get(integration.value);

    counted.set(integration.value, {
      integration,
      name: existing?.name ?? each.providedBy ?? integration.value,
      tools: (existing?.tools ?? 0) + 1,
    });
  }

  return [...counted.values()];
};
