import {
  MAX_SETTINGS_PAGES,
  settingsPagesSchema,
} from '@platform/config/settings-pages';
import { describe, expect, it } from 'vitest';

const billing = {
  id: 'billing',
  label: 'Billing',
  roles: ['owner'],
  script: '/billing/element.js',
  element: 'x-billing-page',
};

const parsed = (pages: unknown) =>
  settingsPagesSchema.safeParse(JSON.stringify(pages));

describe('settingsPagesSchema', () => {
  it.each([undefined, '', '  '])('gives no pages for %j', (raw) => {
    expect(settingsPagesSchema.parse(raw)).toEqual([]);
  });

  it('takes a page, and gives the group and the roles that are not given', () => {
    expect(
      settingsPagesSchema.parse(
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
      settingsPagesSchema.parse(
        JSON.stringify([{ ...billing, group: 'account' }]),
      ),
    ).toEqual([{ ...billing, group: 'account' }]);
  });

  it('refuses a value that is not JSON', () => {
    const result = settingsPagesSchema.safeParse('[{id: billing}]');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/JSON array/);
  });

  it('refuses a value that is not an array', () => {
    expect(parsed(billing).success).toBe(false);
  });

  it.each([
    'https://cdn.example.com/element.js',
    '//cdn.example.com/element.js',
    'billing/element.js',
    '/\\cdn.example.com/element.js',
    '/billing/../admin.js',
    '/billing/./element.js',
    '/billing/element.js?v=1',
    '/billing/element.js#x',
    '/billing/ element.js',
    'javascript:alert(1)',
  ])('refuses the script %j, which is not a path on this origin', (script) => {
    expect(parsed([{ ...billing, script }]).success).toBe(false);
  });

  it.each(['billing', 'X-Billing', '1-billing', 'x_billing', 'x-billing page'])(
    'refuses the element %j, which is not a custom element name',
    (element) => {
      expect(parsed([{ ...billing, element }]).success).toBe(false);
    },
  );

  it.each(['Billing', '1billing', 'bill_ing', 'b'.repeat(33), ''])(
    'refuses the id %j',
    (id) => {
      expect(parsed([{ ...billing, id }]).success).toBe(false);
    },
  );

  it.each([[[]], [['guest']]])('refuses the roles %j', (roles) => {
    expect(parsed([{ ...billing, roles }]).success).toBe(false);
  });

  it.each(['', '   ', 'x'.repeat(41)])('refuses the label %j', (label) => {
    expect(parsed([{ ...billing, label }]).success).toBe(false);
  });

  it('refuses a group that is not account or workspace', () => {
    expect(parsed([{ ...billing, group: 'team' }]).success).toBe(false);
  });

  it('refuses two pages with the same id', () => {
    expect(
      parsed([billing, { ...billing, element: 'x-other-page' }]).success,
    ).toBe(false);
  });

  it('refuses two pages with the same element', () => {
    expect(parsed([billing, { ...billing, id: 'other' }]).success).toBe(false);
  });

  it(`takes at most ${MAX_SETTINGS_PAGES} pages`, () => {
    const pages = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...billing,
        id: `page-${index}`,
        element: `x-page-${index}`,
      }));

    expect(parsed(pages(MAX_SETTINGS_PAGES)).success).toBe(true);
    expect(parsed(pages(MAX_SETTINGS_PAGES + 1)).success).toBe(false);
  });
});
