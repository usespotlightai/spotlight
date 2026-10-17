import type {
  CatalogDenial,
  CatalogNamed,
} from '@catalog/application/contracts/catalog.contract';
import type { CatalogPort } from '@catalog/application/ports/catalog.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { CatalogEntitledMapper } from '@work/application/mappers/catalog-entitled.mapper';
import type {
  ResolvedTool,
  ToolContext,
} from '@work/application/ports/integration-tools.port';
import { LineProblems } from '@work/application/rendering/line-problems';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Station } from '@work/domain/entities/station.entity';
import { CatalogItemDeniedError } from '@work/domain/exceptions/catalog-item-denied.error';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import type { LinePlan } from '@work/domain/value-objects/line-plan.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';

interface Named {
  readonly id: string;
  readonly field: keyof CatalogNamed;
  readonly at: FieldPath;
}

interface StationItems {
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
}

const fromCatalog = ({ tools, skills }: StationItems): CatalogNamed => ({
  tools: tools
    .filter((each) => each.origin === 'catalog')
    .map((each) => each.value),
  skills: skills.filter((each) => each.catalogued).map((each) => each.value),
});

const namedIn = (plan: LinePlan): Named[] =>
  plan.stations.flatMap((station, at) => {
    const named = fromCatalog(station);

    return (['tools', 'skills'] as const).flatMap((field) =>
      [...station[field]].flatMap((each, index) =>
        named[field].includes(each.value)
          ? [
              {
                id: each.value,
                field,
                at: FieldPath.of(['stations', at, field, index]),
              },
            ]
          : [],
      ),
    );
  });

const namesAny = (named: CatalogNamed): boolean =>
  named.tools.length > 0 || named.skills.length > 0;

export interface CatalogAtStation {
  readonly skills: readonly ReadySkillFolder[];
  readonly tools: readonly DeclaredTool[];
  readonly denied: readonly DeniedCatalogItem[];
}

const NOTHING: CatalogAtStation = { skills: [], tools: [], denied: [] };

export class StationCatalog {
  constructor(private readonly catalog: CatalogPort) {}

  async enabledAt(line: Line, station: Station): Promise<CatalogAtStation> {
    const named = fromCatalog(station);

    if (!namesAny(named)) {
      return NOTHING;
    }

    const entitled = await this.catalog.entitledTo(line.workspaceId, named);

    return {
      skills: entitled.skills.map(CatalogEntitledMapper.toFolder),
      tools: entitled.tools.map(CatalogEntitledMapper.toDeclared),
      denied: entitled.denied.map(CatalogEntitledMapper.toDenied),
    };
  }

  async deniedIn(
    workspaceId: WorkspaceId,
    plan: LinePlan,
  ): Promise<readonly ConfigurationProblem[]> {
    const named = namedIn(plan);

    if (named.length === 0) {
      return [];
    }

    const entitled = await this.catalog.entitledTo(workspaceId, {
      tools: named
        .filter((each) => each.field === 'tools')
        .map((each) => each.id),
      skills: named
        .filter((each) => each.field === 'skills')
        .map((each) => each.id),
    });
    const bringing = (denial: CatalogDenial): readonly string[] => [
      denial.id,
      ...entitled.skills
        .filter((skill) => skill.tools.includes(denial.id))
        .map((skill) => skill.id),
    ];

    return entitled.denied.flatMap((denial) =>
      named
        .filter((each) => bringing(denial).includes(each.id))
        .map((each) =>
          LineProblems.catalogDenied(plan.key.value, each.at, denial.because),
        ),
    );
  }

  async resolve(
    tool: Tool,
    run: Run,
    context: ToolContext,
  ): Promise<ResolvedTool | null> {
    const pinned = run.pinnedFor(tool);

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
