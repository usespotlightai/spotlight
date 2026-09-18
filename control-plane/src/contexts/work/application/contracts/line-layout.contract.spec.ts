import {
  linePath,
  stationPath,
} from '@work/application/contracts/line-layout.contract';
import { describe, expect, it } from 'vitest';

describe('the line layout', () => {
  it('keeps a line in a folder of its own, with a file for each station', () => {
    expect(linePath('delivery')).toBe('.spotlight/lines/delivery/line.yml');
    expect(stationPath('delivery', 'triage')).toBe(
      '.spotlight/lines/delivery/stations/triage.md',
    );
  });
});
