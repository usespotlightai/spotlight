import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';

export type StationRule =
  | 'routes'
  | 'tools'
  | 'skills'
  | 'judge'
  | 'alerts'
  | 'search';

export type SearchSetting = 'ceiling' | 'cooldown';

export type PlanFlaw =
  | {
      readonly in: 'line';
      readonly rule: 'stations' | 'repositories' | 'reviews' | null;
    }
  | {
      readonly in: 'station';
      readonly station: StationKey;
      readonly rule: StationRule;
      readonly setting?: SearchSetting;
    }
  | {
      readonly in: 'repository';
      readonly repository: Repository;
      readonly rule: 'setup';
    }
  | {
      readonly in: 'reaction';
      readonly reaction: number;
      readonly rule: 'destination' | 'origin' | 'claim';
    };
