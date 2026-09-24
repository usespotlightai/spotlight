import { Injectable } from '@nestjs/common';
import type { EventProjection } from '@shared-kernel/application/ports/event-projection.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

@Injectable()
export class EventProjections {
  readonly #named = new Map<string, EventProjection>();

  register(projections: readonly EventProjection[]): void {
    for (const projection of projections) {
      if (this.#named.has(projection.name)) {
        throw new Error(
          `Two event projections are both called ${projection.name}`,
        );
      }

      this.#named.set(projection.name, projection);
    }
  }

  async project(event: DomainEvent): Promise<void> {
    for (const projection of this.#named.values()) {
      if (projection.matches(event)) {
        await projection.project(event);
      }
    }
  }
}
