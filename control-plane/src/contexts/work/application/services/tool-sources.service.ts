import type {
  IntegrationToolsPort,
  ReachableTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { BuiltInTools } from '@work/application/services/built-in-tools.service';
import type { StationCatalog } from '@work/application/services/station-catalog.service';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Tool, ToolOrigin } from '@work/domain/value-objects/tool.vo';

type Reaching = (
  tool: Tool,
  run: Run,
  context: ToolContext,
) => Promise<ReachableTool | null>;

export class ToolSources {
  private readonly from: Readonly<Record<ToolOrigin, Reaching>>;

  constructor(
    builtIns: BuiltInTools,
    integrations: IntegrationToolsPort,
    catalog: StationCatalog,
  ) {
    this.from = {
      'built-in': async (tool, _run, context) => builtIns.reach(tool, context),
      integration: (tool, _run, context) => integrations.reach(tool, context),
      catalog: (tool, run, context) => catalog.reach(tool, run, context),
    };
  }

  reach(tool: Tool, run: Run, context: ToolContext) {
    return this.from[tool.origin](tool, run, context);
  }
}
