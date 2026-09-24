import { Client } from '@shared-kernel/domain/value-objects/client.vo';
import { describe, expect, it } from 'vitest';

describe('Client', () => {
  it.each([
    ['terraform-provider/0.1.0', 'terraform-provider', '0.1.0'],
    ['cli/1.2.3-rc.1+build', 'cli', '1.2.3-rc.1+build'],
    [' web ', 'web', null],
  ])('knows %s as it names itself', (header, kind, version) => {
    expect(Client.named(header)).toMatchObject({ kind, version });
  });

  it.each([
    [undefined],
    [''],
    ['curl/8.0'],
    ['terraform-provider/'],
    ['cli/1 2'],
  ])('is unknown when %o names nothing it knows', (header) => {
    expect(Client.named(header).toString()).toBe('unknown');
  });

  it('is recorded the way it named itself', () => {
    expect(Client.named('terraform-provider/0.1.0').toString()).toBe(
      'terraform-provider/0.1.0',
    );
  });
});
