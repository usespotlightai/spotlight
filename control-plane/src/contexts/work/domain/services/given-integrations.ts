import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export interface GivenIntegration {
  readonly name: string;
  readonly tools: number;
}

export const givenIntegrations = (
  described: readonly DeclaredTool[],
): GivenIntegration[] => {
  const counted = new Map<string, GivenIntegration>();

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
