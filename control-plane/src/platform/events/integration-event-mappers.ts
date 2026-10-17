import { Injectable } from '@nestjs/common';
import type { IntegrationEvent } from '@shared-kernel/application/integration-events/integration-event';
import type { IntegrationEventMapper } from '@shared-kernel/application/ports/integration-event-mapper.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

@Injectable()
export class IntegrationEventMappers {
  readonly #from = new Map<string, IntegrationEventMapper[]>();

  register(mappers: readonly IntegrationEventMapper[]): void {
    for (const mapper of mappers) {
      this.#from.set(mapper.from, [
        ...(this.#from.get(mapper.from) ?? []),
        mapper,
      ]);
    }
  }

  of(event: DomainEvent, at: Date): readonly IntegrationEvent[] {
    return (this.#from.get(event.kind) ?? []).map((each) =>
      each.map(event, at),
    );
  }
}
