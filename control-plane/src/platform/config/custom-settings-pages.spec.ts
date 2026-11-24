import {
  MAX_CUSTOM_SETTINGS_PAGES,
  customSettingsPagesSchema,
} from '@platform/config/custom-settings-pages';
import { describe, expect, it } from 'vitest';

const handbook = {
  id: 'handbook',
  label: 'Handbook',
  roles: ['owner'],
  script: '/handbook/element.js',
  element: 'x-handbook-page',
};

const parsed = (pages: unknown) =>
  customSettingsPagesSchema.safeParse(JSON.stringify(pages));

describe('customSettingsPagesSchema', () => {
  it.each([undefined, '', '  '])('gives no pages for %j', (raw) => {
    expect(customSettingsPagesSchema.parse(raw)).toEqual([]);
  });

  it('takes a page, and gives the group and the roles that are not given', () => {
    expect(
      customSettingsPagesSchema.parse(
        JSON.stringify([
          {
            id: 'runbook',
            label: ' Runbook ',
            script: '/runbook/page.js',
            element: 'acme-runbook',
          },
        ]),
      ),
    ).toEqual([
      {
        id: 'runbook',
        label: 'Runbook',
        group: 'workspace',
        roles: ['owner', 'admin'],
        script: '/runbook/page.js',
        element: 'acme-runbook',
      },
    ]);
  });

  it('keeps the group and the roles that are given', () => {
    expect(
      customSettingsPagesSchema.parse(
        JSON.stringify([{ ...handbook, group: 'account' }]),
      ),
    ).toEqual([{ ...handbook, group: 'account' }]);
  });

  it('refuses a value that is not JSON', () => {
    const result = customSettingsPagesSchema.safeParse('[{id: handbook}]');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/JSON array/);
  });

  it('refuses a value that is not an array', () => {
    expect(parsed(handbook).success).toBe(false);
  });

  it.each([
    'https://cdn.example.com/element.js',
    '//cdn.example.com/element.js',
    'handbook/element.js',
    '/\\cdn.example.com/element.js',
    '/handbook/../admin.js',
    '/handbook/./element.js',
    '/handbook/element.js?v=1',
    '/handbook/element.js#x',
    '/handbook/ element.js',
    '/handbook/%2e%2e/admin.js',
    '/handbook/%2E%2E/admin.js',
    'javascript:alert(1)',
  ])('refuses the script %j, which is not a path on this origin', (script) => {
    expect(parsed([{ ...handbook, script }]).success).toBe(false);
  });

  it.each([
    'handbook',
    'X-Handbook',
    '1-handbook',
    'x_handbook',
    'x-handbook page',
  ])(
    'refuses the element %j, which is not a custom element name',
    (element) => {
      expect(parsed([{ ...handbook, element }]).success).toBe(false);
    },
  );

  it.each(['annotation-xml', 'font-face', 'missing-glyph'])(
    'refuses the element %j, which the HTML standard keeps',
    (element) => {
      const result = parsed([{ ...handbook, element }]);

      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toMatch(/keeps for its own/);
    },
  );

  it.each([
    'Handbook',
    'hand_book',
    'hand--book',
    'handbook-',
    '-handbook',
    'b'.repeat(33),
    '',
  ])('refuses the id %j', (id) => {
    expect(parsed([{ ...handbook, id }]).success).toBe(false);
  });

  it.each([[[]], [['guest']]])('refuses the roles %j', (roles) => {
    expect(parsed([{ ...handbook, roles }]).success).toBe(false);
  });

  it.each(['', '   ', 'x'.repeat(41)])('refuses the label %j', (label) => {
    expect(parsed([{ ...handbook, label }]).success).toBe(false);
  });

  it('refuses a group that is not account or workspace', () => {
    expect(parsed([{ ...handbook, group: 'team' }]).success).toBe(false);
  });

  it('refuses two pages with the same id', () => {
    expect(
      parsed([handbook, { ...handbook, element: 'x-other-page' }]).success,
    ).toBe(false);
  });

  it('refuses two pages with the same element', () => {
    expect(parsed([handbook, { ...handbook, id: 'other' }]).success).toBe(
      false,
    );
  });

  it(`takes at most ${MAX_CUSTOM_SETTINGS_PAGES} pages`, () => {
    const pages = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...handbook,
        id: `page-${index}`,
        element: `x-page-${index}`,
      }));

    expect(parsed(pages(MAX_CUSTOM_SETTINGS_PAGES)).success).toBe(true);
    expect(parsed(pages(MAX_CUSTOM_SETTINGS_PAGES + 1)).success).toBe(false);
  });
});
