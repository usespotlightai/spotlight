import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';

export const goneStationName = (): StationName => StationName.of('Unknown');
