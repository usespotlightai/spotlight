import { Injectable } from '@nestjs/common';
import type { IntegrationEvent } from '@shared-kernel/application/integration-events/integration-event';
import type { EventPublication } from '@shared-kernel/application/ports/event-publication.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

@Injectable()
export class EventPublications {
  readonly #from = new Map<string, EventPublication[]>();

  register(publications: readonly EventPublication[]): void {
    for (const publication of publications) {
      this.#from.set(publication.from, [
        ...(this.#from.get(publication.from) ?? []),
        publication,
      ]);
    }
  }

  of(event: DomainEvent, at: Date): readonly IntegrationEvent[] {
    return (this.#from.get(event.kind) ?? []).map((each) =>
      each.publish(event, at),
    );
  }
}
