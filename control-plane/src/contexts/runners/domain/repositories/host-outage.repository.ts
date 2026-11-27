import type { HostOutage } from '@runners/domain/aggregates/host-outage.aggregate';

export interface HostOutageRepository {
  // A pool or trust has one outage at a time. Adding a second one throws a version conflict.
  add(outage: HostOutage): Promise<void>;

  remove(outage: HostOutage): Promise<void>;

  all(): Promise<readonly HostOutage[]>;
}
