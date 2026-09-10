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

  /** Carries another instance's pending events onto this one, so an event
   *  recorded on a task survives the transitions that reshape it before it is
   *  saved. The source is left behind, so nothing is announced twice. */
  protected inheritEvents(from: EventRecorder): void {
    this.pending.push(...from.pending);
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
