import { CachedWorkspaceOutboundHosts } from '@identity/infrastructure/outbound/cached-workspace-outbound-hosts';
import { describe, expect, it, vi } from 'vitest';

const profile = (outboundHosts: string[]) => ({
  id: 'ws_1',
  name: 'Acme',
  slug: 'acme',
  outboundHosts,
});

describe('CachedWorkspaceOutboundHosts', () => {
  it('reads the workspace list once while it is fresh, and again after', async () => {
    let now = 0;
    const profileOf = vi
      .fn()
      .mockResolvedValueOnce(profile(['api.example.com']))
      .mockResolvedValueOnce(profile(['*.acme.io']));
    const hosts = new CachedWorkspaceOutboundHosts({ profileOf }, () => now);

    expect((await hosts.of('ws_1')).entries).toEqual(['api.example.com']);
    now = 29_999;
    expect((await hosts.of('ws_1')).entries).toEqual(['api.example.com']);
    now = 30_000;
    expect((await hosts.of('ws_1')).entries).toEqual(['*.acme.io']);
    expect(profileOf).toHaveBeenCalledTimes(2);
  });

  it('reads the list again when asked for it fresh, and keeps that reading', async () => {
    const profileOf = vi
      .fn()
      .mockResolvedValueOnce(profile(['api.example.com']))
      .mockResolvedValueOnce(profile(['hooks.example.com']));
    const hosts = new CachedWorkspaceOutboundHosts({ profileOf }, () => 0);

    await hosts.of('ws_1');

    expect((await hosts.fresh('ws_1')).entries).toEqual(['hooks.example.com']);
    expect((await hosts.of('ws_1')).entries).toEqual(['hooks.example.com']);
    expect(profileOf).toHaveBeenCalledTimes(2);
  });

  it('refuses to answer for a workspace it cannot find', async () => {
    const hosts = new CachedWorkspaceOutboundHosts({
      profileOf: async () => null,
    });

    await expect(hosts.of('ws_gone')).rejects.toThrow(
      'workspace ws_gone does not exist',
    );
  });

  it('reads again once told to forget a workspace', async () => {
    const profileOf = vi
      .fn()
      .mockResolvedValueOnce(profile(['api.example.com']))
      .mockResolvedValueOnce(profile(['hooks.example.com']));
    const hosts = new CachedWorkspaceOutboundHosts({ profileOf }, () => 0);

    await hosts.of('ws_1');
    hosts.forget('ws_1');

    expect((await hosts.of('ws_1')).entries).toEqual(['hooks.example.com']);
  });

  it('reads again after a failed read', async () => {
    const profileOf = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection lost'))
      .mockResolvedValueOnce(profile([]));
    const hosts = new CachedWorkspaceOutboundHosts({ profileOf });

    await expect(hosts.of('ws_1')).rejects.toThrow('connection lost');
    await expect(hosts.of('ws_1')).resolves.toMatchObject({ entries: [] });
  });
});
