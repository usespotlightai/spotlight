import type { HarnessCatalogue } from '@work/domain/value-objects/harness-catalogue.vo';

export interface HarnessCataloguePort {
  current(): HarnessCatalogue;
}
