import { BadRequestException } from '@nestjs/common';
import { isoTimeOf } from '@platform/http/iso-time';
import { describe, expect, it } from 'vitest';

describe('isoTimeOf', () => {
  it.each([
    ['2027-01-01T00:00:00Z', '2027-01-01T00:00:00.000Z'],
    ['2027-01-01T00:00Z', '2027-01-01T00:00:00.000Z'],
    ['2027-01-01T09:30:00.123Z', '2027-01-01T09:30:00.123Z'],
    ['2027-01-01T10:00:00+01:00', '2027-01-01T09:00:00.000Z'],
  ])('reads %s', (raw, time) => {
    expect(isoTimeOf('since', raw).toISOString()).toBe(time);
  });

  it.each([
    'soon',
    '2027-01-01',
    '2027-01-01T00:00:00',
    'March 3, 2027',
    '1798761600000',
    '2027-13-01T00:00:00Z',
  ])('refuses %s, naming the field', (raw) => {
    expect(() => isoTimeOf('since', raw)).toThrow(BadRequestException);
    expect(() => isoTimeOf('since', raw)).toThrow(
      'Sorry, since must be an ISO 8601 time',
    );
  });
});
