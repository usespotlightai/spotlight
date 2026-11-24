import type { Env } from '@platform/config/env.schema';
import { SettingsPagesController } from '@platform/http/controllers/settings-pages.controller';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { describe, expect, it } from 'vitest';

const billing: Env['SPOTLIGHT_SETTINGS_PAGES'][number] = {
  id: 'billing',
  label: 'Billing',
  group: 'workspace',
  roles: ['owner'],
  script: '/billing/element.js',
  element: 'x-billing-page',
};

const controller = (pages: Env['SPOTLIGHT_SETTINGS_PAGES']) =>
  new SettingsPagesController({ SPOTLIGHT_SETTINGS_PAGES: pages } as Env);

describe('SettingsPagesController', () => {
  it('lists the settings pages of the deployment', () => {
    expect(controller([billing]).handle()).toEqual({
      pages: [billing],
    });
  });

  it('lists none when the deployment sets none', () => {
    expect(controller([]).handle()).toEqual({ pages: [] });
  });

  it('answers only a person who is signed in', () => {
    expect(
      Reflect.getMetadata(
        ALLOW_ANONYMOUS,
        SettingsPagesController.prototype.handle,
      ),
    ).toBeUndefined();
  });
});
