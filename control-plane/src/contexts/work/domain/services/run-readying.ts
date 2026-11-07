import type { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';
import {
  type ReadyProfile,
  withoutServers,
} from '@work/domain/value-objects/ready-profile';
import type { Station } from '@work/domain/value-objects/station.vo';

export interface RunReadying {
  denied(
    station: Station,
    denied: readonly DeniedCatalogItem[],
  ): readonly DeniedCatalogItem[];
  profile(profile: ReadyProfile): ReadyProfile;
}

const asATaskRun: RunReadying = {
  denied: (_station, denied) => denied,
  profile: (profile) => profile,
};

const asATrial: RunReadying = {
  denied: (station, denied) =>
    denied.filter(
      (each) => !station.tools.some((tool) => tool.value === each.id),
    ),
  profile: withoutServers,
};

export const RunReadying = { asATaskRun, asATrial };
