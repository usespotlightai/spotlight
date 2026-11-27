import type { Env } from '@platform/config/env.schema';
import { CustomSettingsPagesController } from '@platform/http/controllers/custom-settings-pages.controller';
import { ALLOW_ANONYMOUS } from '@platform/http/decorators/allow-anonymous.decorator';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

const handbook: Env['SPOTLIGHT_CUSTOM_SETTINGS_PAGES'][number] = {
  id: 'handbook',
  label: 'Handbook',
  group: 'workspace',
  roles: ['owner'],
  script: '/handbook/element.js',
  element: 'x-handbook-page',
};

const controller = (pages: Env['SPOTLIGHT_CUSTOM_SETTINGS_PAGES']) =>
  new CustomSettingsPagesController(
    partial<Env>({
      SPOTLIGHT_CUSTOM_SETTINGS_PAGES: pages,
    }),
  );

describe('CustomSettingsPagesController', () => {
  it('lists the custom settings pages of the deployment', () => {
    expect(controller([handbook]).handle()).toEqual({
      pages: [handbook],
    });
  });

  it('lists none when the deployment sets none', () => {
    expect(controller([]).handle()).toEqual({ pages: [] });
  });

  it('answers only a person who is signed in', () => {
    expect(
      Reflect.getMetadata(
        ALLOW_ANONYMOUS,
        CustomSettingsPagesController.prototype.handle,
      ),
    ).toBeUndefined();
  });
});
