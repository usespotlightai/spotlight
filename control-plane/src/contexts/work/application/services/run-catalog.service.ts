import type { CatalogRequest } from '@catalog/application/contracts/catalog.contract';
import type { CatalogPort } from '@catalog/application/ports/catalog.port';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { CatalogEntitledMapper } from '@work/application/mappers/catalog-entitled.mapper';
import type {
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import type { LeasedRun } from '@work/application/ports/run-leases.port';
import { CatalogItemDeniedError } from '@work/domain/exceptions/catalog-item-denied.error';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { Station } from '@work/domain/value-objects/station.vo';

interface StationItems {
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
}

const fromCatalog = ({ tools, skills }: StationItems): CatalogRequest => ({
  tools: tools
    .filter((each) => each.origin === 'catalog')
    .map((each) => each.value),
  skills: skills.filter((each) => each.catalogued).map((each) => each.value),
});

const namesAny = (request: CatalogRequest): boolean =>
  request.tools.length > 0 || request.skills.length > 0;

export interface CatalogAtStation {
  readonly skills: readonly ReadySkillFolder[];
  readonly tools: readonly DeclaredTool[];
  readonly denied: readonly DeniedCatalogItem[];
}

const NOTHING: CatalogAtStation = { skills: [], tools: [], denied: [] };

export class RunCatalog {
  constructor(private readonly catalog: CatalogPort) {}

  async enabledAt(line: LineMap, station: Station): Promise<CatalogAtStation> {
    const request = fromCatalog(station);

    if (!namesAny(request)) {
      return NOTHING;
    }

    const entitled = await this.catalog.entitledTo(line.workspaceId, request);

    return {
      skills: entitled.skills.map(CatalogEntitledMapper.toFolder),
      tools: entitled.tools.map(CatalogEntitledMapper.toDeclared),
      denied: entitled.denied.map(CatalogEntitledMapper.toDenied),
    };
  }

  async resolve(
    tool: Tool,
    run: LeasedRun,
    context: ToolContext,
  ): Promise<ResolvedTool | null> {
    const pinned =
      run.pins
        .map((each) => Tool.of(each))
        .find((each) => each.called === tool.called) ?? null;

    if (!pinned) {
      return null;
    }

    const entitled = await this.catalog.entitledTo(context.workspaceId, {
      tools: [pinned.value],
      skills: [],
    });
    const [denied] = entitled.denied;

    if (denied) {
      throw new CatalogItemDeniedError(CatalogEntitledMapper.toDenied(denied));
    }

    const found = entitled.tools.find((each) => each.id === pinned.value);

    return found
      ? {
          declared: CatalogEntitledMapper.toDeclared(found),
          actingAs: null,
          missing: null,
          personRule: null,
          defaultFor: () => undefined,
          call: async (inputs) => {
            const answer = await this.catalog.call({
              workspaceId: context.workspaceId,
              runId: context.runId,
              id: pinned.value,
              inputs: inputs.values,
            });

            if (answer.kind === 'denied') {
              throw new CatalogItemDeniedError(
                CatalogEntitledMapper.toDenied(answer.denial),
              );
            }

            return answer.output;
          },
        }
      : null;
  }
}
