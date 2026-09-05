import type { DomainEvent } from '@domain/events/domain-event';

/**
 * What an aggregate has done that something outside it may need to answer. A
 * transition records onto the new instance it returns; pulling drains that
 * instance in place, since the events are a note for whoever saves it rather
 * than part of what it is.
 */
export abstract class EventRecorder {
  private pending: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pending.push(event);
  }

  pullEvents(): readonly DomainEvent[] {
    const pulled = this.pending;
    this.pending = [];

    return pulled;
  }

  get hasEvents(): boolean {
    return this.pending.length > 0;
  }
}
