import type { LeasedRun } from '@runs/application/ports/run-leases.port';
import type {
  Tool,
  ToolOrigin,
} from '@shared-kernel/domain/value-objects/tool.vo';
import type {
  IntegrationToolsPort,
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { BuiltInTools } from '@work/application/services/built-in-tools.service';
import type { RunCatalog } from '@work/application/services/run-catalog.service';

type ToolResolver = (
  tool: Tool,
  run: LeasedRun,
  context: ToolContext,
  runnerId: string,
) => Promise<ResolvedTool | null>;

export class ToolSources {
  private readonly from: Readonly<Record<ToolOrigin, ToolResolver>>;

  constructor(
    builtIns: BuiltInTools,
    integrations: IntegrationToolsPort,
    catalog: RunCatalog,
  ) {
    this.from = {
      'built-in': async (tool, _run, context) =>
        builtIns.resolve(tool, context),
      integration: (tool, run, context, runnerId) =>
        integrations.resolve(tool, context, run, runnerId),
      catalog: (tool, run, context) => catalog.resolve(tool, run, context),
    };
  }

  resolve(tool: Tool, run: LeasedRun, context: ToolContext, runnerId: string) {
    return this.from[tool.origin](tool, run, context, runnerId);
  }
}
