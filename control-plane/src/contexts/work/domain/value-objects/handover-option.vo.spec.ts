import { HandoverOption } from '@work/domain/value-objects/handover-option.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

describe('HandoverOption', () => {
  it('is written as the key of the station it passes to', () => {
    const option = HandoverOption.station(
      StationKey.of('code-review'),
      StationName.of('Code Review'),
    );

    expect(option.kind).toBe('station');
    expect(option.word).toBe('code-review');
    expect(option.station?.name.value).toBe('Code Review');
  });

  it('is written as review where it goes to a person', () => {
    const option = HandoverOption.review();

    expect(option.kind).toBe('review');
    expect(option.word).toBe('review');
    expect(option.station).toBeNull();
  });

  it('is written as done where it finishes the work', () => {
    const option = HandoverOption.done();

    expect(option.kind).toBe('done');
    expect(option.word).toBe('done');
    expect(option.station).toBeNull();
  });
});
