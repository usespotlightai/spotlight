export const LINES_UNDER = '.spotlight/lines';

export const LINE_FILE = 'line.yml';

export const STATIONS_UNDER = 'stations';

export const lineFolder = (lineKey: string): string =>
  `${LINES_UNDER}/${lineKey}`;

export const linePath = (lineKey: string): string =>
  `${lineFolder(lineKey)}/${LINE_FILE}`;

export const stationsFolder = (lineKey: string): string =>
  `${lineFolder(lineKey)}/${STATIONS_UNDER}`;

export const stationPath = (lineKey: string, stationKey: string): string =>
  `${stationsFolder(lineKey)}/${stationKey}.md`;
