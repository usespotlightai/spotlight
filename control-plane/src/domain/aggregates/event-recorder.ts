import type { DomainEvent } from '@domain/events/domain-event';

// A transition records onto the instance it returns, not the one it was called on.
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
