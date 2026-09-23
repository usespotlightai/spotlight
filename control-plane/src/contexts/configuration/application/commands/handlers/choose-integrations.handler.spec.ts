import { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import { ChooseIntegrationsHandler } from '@configuration/application/commands/handlers/choose-integrations.handler';
import type {
  ConfigurationChange,
  ProposeConfigurationChange,
} from '@configuration/application/services/propose-configuration-change.service';
import { describe, expect, it, vi } from 'vitest';

const handler = () => {
  let asked: ConfigurationChange | undefined;

  const proposals = {
    propose: vi.fn(async (change: ConfigurationChange) => {
      if (change.files.length + change.removes.length === 0) {
        return null;
      }

      asked = change;
      return { url: 'https://example/pr/1' };
    }),
  } as unknown as ProposeConfigurationChange;

  return {
    handler: new ChooseIntegrationsHandler(proposals, {
      all: () => [],
      fileFor: (source: string) =>
        ['linear', 'sentry', 'slack'].includes(source)
          ? `version: 1\nintegration: ${source}\n`
          : null,
    }),
    asked: () => asked,
  };
};

const paths = (change: ConfigurationChange | undefined) =>
  (change?.files ?? []).map((each) => each.path);

describe('ChooseIntegrations', () => {
  it('writes a chosen integration’s file', async () => {
    const { handler: choose, asked } = handler();

    await choose.execute(
      new ChooseIntegrationsCommand('team_1', ['sentry'], 'user_1', []),
    );

    expect(paths(asked())).toEqual(['.spotlight/integrations/sentry.yml']);
  });

  it('removes a dropped integration’s file', async () => {
    const { handler: choose, asked } = handler();

    await choose.execute(
      new ChooseIntegrationsCommand('team_1', [], 'user_1', ['linear']),
    );

    expect(paths(asked())).toHaveLength(0);
    expect(asked()?.removes).toContain('.spotlight/integrations/linear.yml');
  });

  it('says nothing where a host nobody knows is the only one chosen', async () => {
    const { handler: choose, asked } = handler();

    await expect(
      choose.execute(
        new ChooseIntegrationsCommand('team_1', ['nonesuch'], 'user_1', []),
      ),
    ).resolves.toBeNull();
    expect(asked()).toBeUndefined();
  });
});
