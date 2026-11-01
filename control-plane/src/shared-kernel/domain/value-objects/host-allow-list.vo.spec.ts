import { InvalidHostAllowListError } from '@shared-kernel/domain/exceptions/invalid-host-allow-list.error';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { describe, expect, it } from 'vitest';

describe('HostAllowList', () => {
  it('permits every host when the list is empty, and names none', () => {
    const hosts = HostAllowList.listed('');

    expect(hosts.isEmpty).toBe(true);
    expect(hosts.allows('api.example.com')).toBe(true);
    expect(hosts.allows(' ')).toBe(false);
    expect(hosts.named('api.example.com')).toBe(false);
  });

  it('permits only the hosts a list names, exactly or by a pattern for subdomains', () => {
    const hosts = HostAllowList.listed(' Slack.com , *.acme.internal ');

    expect(hosts.allows('slack.com')).toBe(true);
    expect(hosts.allows('SLACK.COM.')).toBe(true);
    expect(hosts.allows('files.slack.com')).toBe(false);
    expect(hosts.allows('git.acme.internal')).toBe(true);
    expect(hosts.allows('acme.internal')).toBe(false);
    expect(hosts.allows('evilacme.internal')).toBe(false);
    expect(hosts.allows('example.com')).toBe(false);
    expect(hosts.named('git.acme.internal')).toBe(true);
  });

  it('keeps each entry once, written the way it is matched', () => {
    expect(
      HostAllowList.of(['API.example.com.', 'api.example.com', '*.Acme.io'])
        .entries,
    ).toEqual(['*.acme.io', 'api.example.com']);
  });

  it('equals another list with the same entries in the same order', () => {
    expect(
      HostAllowList.of(['a.example.com']).equals(
        HostAllowList.of(['A.example.com']),
      ),
    ).toBe(true);
    expect(HostAllowList.of(['a.example.com']).equals(HostAllowList.none)).toBe(
      false,
    );
  });

  it('equals another list with the same entries in any order', () => {
    expect(
      HostAllowList.of(['b.example.com', 'a.example.com']).equals(
        HostAllowList.of(['a.example.com', 'b.example.com']),
      ),
    ).toBe(true);
  });

  it('restores stored entries without checking them again', () => {
    expect(HostAllowList.restored(['*', 'b.example.com']).entries).toEqual([
      '*',
      'b.example.com',
    ]);
  });

  it('refuses an entry with a character a host name cannot have, naming the xn-- form', () => {
    expect(() => HostAllowList.of(['bücher.example'])).toThrow(/xn--/);
    expect(
      HostAllowList.of(['xn--bcher-kva.example']).allows(
        'xn--bcher-kva.example',
      ),
    ).toBe(true);
  });

  it.each([
    ['*'],
    ['*.com'],
    ['*.*.example.com'],
    ['example.com:443'],
    ['https://example.com'],
    ['example.com/path'],
    [''],
  ])('refuses the entry %j', (entry) => {
    expect(() => HostAllowList.of([entry])).toThrow(InvalidHostAllowListError);
  });
});
