import type {
  IntegrationToolsPort,
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { BuiltInTools } from '@work/application/services/built-in-tools.service';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Tool, ToolOrigin } from '@work/domain/value-objects/tool.vo';

type ToolResolver = (
  tool: Tool,
  run: Run,
  context: ToolContext,
  runnerId: string,
) => Promise<ResolvedTool | null>;

export class ToolSources {
  private readonly from: Readonly<Record<ToolOrigin, ToolResolver>>;

  constructor(
    builtIns: BuiltInTools,
    integrations: IntegrationToolsPort,
    catalog: StationCatalog,
  ) {
    this.from = {
      'built-in': async (tool, _run, context) =>
        builtIns.resolve(tool, context),
      integration: (tool, run, context, runnerId) =>
        integrations.resolve(tool, context, run.currentAttempt, runnerId),
      catalog: (tool, run, context) => catalog.resolve(tool, run, context),
    };
  }

  resolve(tool: Tool, run: Run, context: ToolContext, runnerId: string) {
    return this.from[tool.origin](tool, run, context, runnerId);
  }
}
