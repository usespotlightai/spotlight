import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  OutboundBlockedError,
  OutboundGuard,
} from '@platform/outbound/outbound-guard';
import { OutboundScope } from '@platform/outbound/outbound-scope';
import { HostAllowList } from '@shared-kernel/domain/value-objects/host-allow-list.vo';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((request, response) => {
    if (request.url === '/named') {
      response.writeHead(302, { location: `http://localhost:${port}/` });
      response.end();
      return;
    }

    if (request.url === '/elsewhere') {
      response.writeHead(302, { location: 'http://169.254.169.254/latest' });
      response.end();
      return;
    }

    response.end('reached');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise((done) => server.close(done));
});

const guard = (setting: string, loopbackAllowed = false) =>
  new OutboundGuard(HostAllowList.listed(setting), loopbackAllowed);

describe('OutboundGuard', () => {
  it('never connects to a loopback address, even one the deployment names', async () => {
    await expect(
      guard('127.0.0.1').fetch(`http://127.0.0.1:${port}/`),
    ).rejects.toThrow(OutboundBlockedError);
  });

  it('never connects to a name that resolves to a loopback address', async () => {
    await expect(guard('').fetch(`http://localhost:${port}/`)).rejects.toThrow(
      /resolves to (127\.0\.0\.1|::1)/,
    );
  });

  it('refuses a private address the deployment does not name, before it connects', async () => {
    await expect(guard('').fetch('http://10.0.0.7:8080/')).rejects.toThrow(
      /private address/,
    );
  });

  it('refuses a host that is not on the list, before it looks the host up', async () => {
    await expect(
      guard('slack.com').fetch('https://example.invalid/'),
    ).rejects.toThrow(/not on the allowed list/);
  });

  it('checks a URL against the list by its host name, without the port', () => {
    expect(() =>
      guard('slack.com').check('https://slack.com:8443/api'),
    ).not.toThrow();
    expect(() => guard('slack.com').check('https://example.com/')).toThrow(
      OutboundBlockedError,
    );
  });

  it('calls a loopback host the deployment names when loopback is allowed', async () => {
    const reply = await guard('127.0.0.1', true).fetch(
      `http://127.0.0.1:${port}/`,
    );

    await expect(reply.text()).resolves.toBe('reached');
  });

  it('refuses a redirect that fetch follows to an address it never calls', async () => {
    await expect(
      guard('127.0.0.1,169.254.169.254', true).fetch(
        `http://127.0.0.1:${port}/elsewhere`,
      ),
    ).rejects.toThrow(/link-local/);
  });

  it.each(['http://[::ffff:7f00:1]/', 'http://2130706433/', 'http://0x7f.1/'])(
    'refuses the loopback address written as %s',
    async (url) => {
      await expect(guard('').fetch(url)).rejects.toThrow(/loopback address/);
    },
  );

  it('refuses a host the workspace in scope does not list, saying whose list it is', () => {
    expect(() =>
      OutboundScope.within(HostAllowList.of(['slack.com']), () =>
        guard('').check('https://example.com/'),
      ),
    ).toThrow("Host is not on the workspace's allowed list.");
  });

  it('calls a host the workspace in scope lists, and any host outside a scope', () => {
    expect(() =>
      OutboundScope.within(HostAllowList.of(['*.slack.com']), () =>
        guard('').check('https://files.slack.com/'),
      ),
    ).not.toThrow();
    expect(() => guard('').check('https://example.com/')).not.toThrow();
  });

  it('narrows nothing for a workspace with an empty list', () => {
    expect(() =>
      OutboundScope.within(HostAllowList.none, () =>
        guard('').check('https://example.com/'),
      ),
    ).not.toThrow();
  });

  it('still refuses a host the deployment does not list, whatever the workspace lists', () => {
    expect(() =>
      OutboundScope.within(HostAllowList.of(['example.com']), () =>
        guard('slack.com').check('https://example.com/'),
      ),
    ).toThrow('Host is not on the allowed list.');
  });

  it('keeps every enclosing list when scopes nest', () => {
    expect(() =>
      OutboundScope.within(HostAllowList.of(['slack.com']), () =>
        OutboundScope.within(HostAllowList.of(['example.com']), () =>
          guard('').check('https://example.com/'),
        ),
      ),
    ).toThrow(OutboundBlockedError);
  });

  it('refuses a request fetch makes for a host outside the workspace list, before it connects', async () => {
    await expect(
      OutboundScope.within(HostAllowList.of(['slack.com']), () =>
        guard('127.0.0.1', true).fetch(`http://127.0.0.1:${port}/`),
      ),
    ).rejects.toThrow("Host is not on the workspace's allowed list.");
  });

  it('refuses a redirect fetch follows to a host outside the workspace list', async () => {
    const reached = OutboundScope.within(HostAllowList.of(['127.0.0.1']), () =>
      guard('127.0.0.1,localhost', true).fetch(
        `http://127.0.0.1:${port}/named`,
      ),
    );

    await expect(reached).rejects.toMatchObject({
      host: 'localhost',
      reason: "Host is not on the workspace's allowed list.",
    });
  });

  it('keeps each of two interleaved scopes to its own list', async () => {
    const checking = (allowed: string, other: string) =>
      OutboundScope.within(HostAllowList.of([allowed]), async () => {
        await new Promise((done) => setTimeout(done, 5));
        const seen = [
          OutboundScope.allows(allowed),
          OutboundScope.allows(other),
        ];
        await new Promise((done) => setTimeout(done, 1));

        return [...seen, OutboundScope.allows(allowed)];
      });

    await expect(
      Promise.all([
        checking('a.example.com', 'b.example.com'),
        checking('b.example.com', 'a.example.com'),
      ]),
    ).resolves.toEqual([
      [true, false, true],
      [true, false, true],
    ]);
  });
});
