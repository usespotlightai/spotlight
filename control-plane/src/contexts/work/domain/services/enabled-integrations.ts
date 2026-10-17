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
    const source = each.tool.integration;

    if (source === null) {
      continue;
    }

    const existing = counted.get(source);

    counted.set(source, {
      name: existing?.name ?? each.offeredBy ?? source,
      tools: (existing?.tools ?? 0) + 1,
    });
  }

  return [...counted.values()];
};
