import { OutboundHosts } from '@platform/outbound/outbound-hosts';
import { describe, expect, it } from 'vitest';

describe('OutboundHosts', () => {
  it('permits every host when the list is empty, and names none', () => {
    const hosts = OutboundHosts.listed('');

    expect(hosts.allows('api.example.com')).toBe(true);
    expect(hosts.named('api.example.com')).toBe(false);
  });

  it('permits only the hosts a list names, exactly or by a pattern for subdomains', () => {
    const hosts = OutboundHosts.listed(' Slack.com , *.acme.internal ');

    expect(hosts.allows('slack.com')).toBe(true);
    expect(hosts.allows('SLACK.COM.')).toBe(true);
    expect(hosts.allows('files.slack.com')).toBe(false);
    expect(hosts.allows('git.acme.internal')).toBe(true);
    expect(hosts.allows('acme.internal')).toBe(false);
    expect(hosts.allows('example.com')).toBe(false);
    expect(hosts.named('git.acme.internal')).toBe(true);
  });

  it.each([
    ['*'],
    ['*.com'],
    ['*.*.example.com'],
    ['example.com:443'],
    ['https://example.com'],
    ['example.com/path'],
  ])('refuses the entry %s', (entry) => {
    expect(() => OutboundHosts.listed(entry)).toThrow();
  });
});
