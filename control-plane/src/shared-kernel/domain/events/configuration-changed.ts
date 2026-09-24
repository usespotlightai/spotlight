import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';

export interface ConfigurationChanged extends DomainEvent {
  readonly change: ConfigurationChange;
}

export const changesConfiguration = (
  event: DomainEvent,
): event is ConfigurationChanged =>
  (event as Partial<ConfigurationChanged>).change instanceof
  ConfigurationChange;
