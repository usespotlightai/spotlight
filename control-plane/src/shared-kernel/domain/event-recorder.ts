import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export abstract class EventRecorder {
  private pending: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pending.push(event);
  }

  protected inheritEvents(
    from: EventRecorder,
    kept: (event: DomainEvent) => boolean = () => true,
  ): void {
    this.pending.push(...from.pending.filter(kept));
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
