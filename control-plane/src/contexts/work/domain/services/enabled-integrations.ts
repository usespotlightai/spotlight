import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export interface EnabledIntegration {
  readonly name: string;
  readonly tools: number;
}

export const enabledIntegrations = (
  described: readonly DeclaredTool[],
): EnabledIntegration[] => {
  const counted = new Map<string, EnabledIntegration>();

  for (const each of described) {
    const integration = each.tool.integration;

    if (integration === null) {
      continue;
    }

    const existing = counted.get(integration);

    counted.set(integration, {
      name: existing?.name ?? each.providedBy ?? integration,
      tools: (existing?.tools ?? 0) + 1,
    });
  }

  return [...counted.values()];
};
