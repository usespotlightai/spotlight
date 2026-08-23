import type { Factory } from '@domain/aggregates/factory.aggregate';

export interface FactoryRepository {
  add(factory: Factory): Promise<void>;
}
