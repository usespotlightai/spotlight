import type { CatalogPort } from '@catalog/application/ports/catalog.port';
import { LineProblems } from '@lines/application/rendering/line-problems';
import { cataloguedIn, deniedIn } from '@lines/domain/services/catalog-denial';
import type { LinePlan } from '@lines/domain/value-objects/line-plan.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export class CatalogDenials {
  constructor(private readonly catalog: CatalogPort) {}

  async deniedIn(plan: LinePlan): Promise<readonly ConfigurationProblem[]> {
    const items = cataloguedIn(plan);

    if (items.length === 0) {
      return [];
    }

    const resolved = await this.catalog.resolve({
      tools: items
        .filter((each) => each.field === 'tools')
        .map((each) => each.item.value),
      skills: items
        .filter((each) => each.field === 'skills')
        .map((each) => each.item.value),
    });

    return deniedIn(items, resolved.denied).map(({ item, because }) =>
      LineProblems.catalogDenied(plan.key.value, item.at, because),
    );
  }
}
