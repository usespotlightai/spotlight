import type {
  CatalogDenial,
  CatalogNamed,
} from '@catalog/application/contracts/catalog.contract';
import type { CatalogPort } from '@catalog/application/ports/catalog.port';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { CatalogGivenMapper } from '@work/application/mappers/catalog-given.mapper';
import type {
  ReachableTool,
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

interface Giving {
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
}

const fromCatalog = ({ tools, skills }: Giving): CatalogNamed => ({
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

const asked = (named: CatalogNamed): boolean =>
  named.tools.length > 0 || named.skills.length > 0;

export interface CatalogAtStation {
  readonly skills: readonly ReadySkillFolder[];
  readonly tools: readonly DeclaredTool[];
  readonly denied: readonly DeniedCatalogItem[];
}

const NOTHING: CatalogAtStation = { skills: [], tools: [], denied: [] };

export class StationCatalog {
  constructor(private readonly catalog: CatalogPort) {}

  async givenAt(line: Line, station: Station): Promise<CatalogAtStation> {
    const named = fromCatalog(station);

    if (!asked(named)) {
      return NOTHING;
    }

    const given = await this.catalog.givenTo(line.workspaceId, named);

    return {
      skills: given.skills.map(CatalogGivenMapper.toFolder),
      tools: given.tools.map(CatalogGivenMapper.toDeclared),
      denied: given.denied.map(CatalogGivenMapper.toDenied),
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

    const given = await this.catalog.givenTo(workspaceId, {
      tools: named
        .filter((each) => each.field === 'tools')
        .map((each) => each.id),
      skills: named
        .filter((each) => each.field === 'skills')
        .map((each) => each.id),
    });
    const bringing = (denial: CatalogDenial): readonly string[] => [
      denial.id,
      ...given.skills
        .filter((skill) => skill.tools.includes(denial.id))
        .map((skill) => skill.id),
    ];

    return given.denied.flatMap((denial) =>
      named
        .filter((each) => bringing(denial).includes(each.id))
        .map((each) =>
          LineProblems.catalogDenied(plan.key.value, each.at, denial.because),
        ),
    );
  }

  async reach(
    tool: Tool,
    run: Run,
    context: ToolContext,
  ): Promise<ReachableTool | null> {
    const pinned = run.pinnedFor(tool);

    if (!pinned) {
      return null;
    }

    const given = await this.catalog.givenTo(context.workspaceId, {
      tools: [pinned.value],
      skills: [],
    });
    const [denied] = given.denied;

    if (denied) {
      throw new CatalogItemDeniedError(CatalogGivenMapper.toDenied(denied));
    }

    const found = given.tools.find((each) => each.id === pinned.value);

    return found
      ? {
          declared: CatalogGivenMapper.toDeclared(found),
          actingAs: null,
          wants: null,
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
                CatalogGivenMapper.toDenied(answer.denial),
              );
            }

            return answer.output;
          },
        }
      : null;
  }
}
