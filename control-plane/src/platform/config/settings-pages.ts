import { z } from 'zod';

// The workspace roles, as the identity context names them. The platform does not import a context, so it keeps its own copy.
export const SETTINGS_PAGE_ROLES = ['owner', 'admin', 'member'] as const;

export const SETTINGS_PAGE_GROUPS = ['account', 'workspace'] as const;

export const MAX_SETTINGS_PAGES = 8;

// A path on the origin of the web app, so that the page script obeys the script-src 'self' of the web app. It refuses a URL with a scheme, a URL without one (//host/x.js), a backslash and a dot segment.
const isOwnPath = (raw: string): boolean =>
  raw.startsWith('/') &&
  !raw.startsWith('//') &&
  !raw.includes('\\') &&
  !/[\s?#]/.test(raw) &&
  !raw.split('/').some((segment) => segment === '.' || segment === '..');

const settingsPageSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,31}$/, 'is a lowercase id, as in billing'),
  label: z.string().trim().min(1).max(40),
  group: z.enum(SETTINGS_PAGE_GROUPS).default('workspace'),
  roles: z
    .array(z.enum(SETTINGS_PAGE_ROLES))
    .min(1)
    .default(['owner', 'admin']),
  script: z
    .string()
    .refine(isOwnPath, 'is a path on this origin, as in /billing/element.js'),
  element: z
    .string()
    .regex(
      /^[a-z][a-z0-9]*-[a-z0-9-]*$/,
      'is a custom element name, as in x-billing-page',
    ),
});

export type SettingsPage = z.infer<typeof settingsPageSchema>;

// SPOTLIGHT_SETTINGS_PAGES: a JSON array of the pages that the deployment adds to the settings of the web app. Each page is a custom element that a script on this origin defines.
export const settingsPagesSchema = z
  .string()
  .default('')
  .transform((raw, context) => {
    if (raw.trim() === '') {
      return [];
    }

    try {
      return JSON.parse(raw) as unknown;
    } catch {
      context.addIssue({
        code: 'custom',
        message:
          'is a JSON array of settings pages, as in [{"id":"billing","label":"Billing","script":"/billing/element.js","element":"x-billing-page"}]',
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(settingsPageSchema)
      .max(MAX_SETTINGS_PAGES)
      .refine(
        (pages) => new Set(pages.map((each) => each.id)).size === pages.length,
        'gives each settings page its own id',
      )
      .refine(
        (pages) =>
          new Set(pages.map((each) => each.element)).size === pages.length,
        'gives each settings page its own element',
      ),
  );
