import type {
  CatalogDenial,
  CatalogRequest,
} from '@catalog/application/contracts/catalog.contract';
import type { CatalogPort } from '@catalog/application/ports/catalog.port';
import { LineProblems } from '@lines/application/rendering/line-problems';
import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface Named {
  readonly id: string;
  readonly field: keyof CatalogRequest;
  readonly at: FieldPath;
}

const namedIn = (plan: LinePlan): Named[] =>
  plan.stations.flatMap((station, at) => {
    const catalogued = {
      tools: station.tools
        .filter((each) => each.origin === 'catalog')
        .map((each) => each.value),
      skills: station.skills
        .filter((each) => each.catalogued)
        .map((each) => each.value),
    };

    return (['tools', 'skills'] as const).flatMap((field) =>
      [...station[field]].flatMap((each, index) =>
        catalogued[field].includes(each.value)
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

export class CatalogDenials {
  constructor(private readonly catalog: CatalogPort) {}

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
}
