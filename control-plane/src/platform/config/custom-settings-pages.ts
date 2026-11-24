import { SLUG_SHAPE } from '@shared-kernel/domain/value-objects/identifier-shapes';
import { WORKSPACE_ROLE_NAMES } from '@shared-kernel/domain/value-objects/workspace-role-names';
import { z } from 'zod';

const MAX_ID_LENGTH = 32;

export const CUSTOM_SETTINGS_PAGE_GROUPS = ['account', 'workspace'] as const;

export const MAX_CUSTOM_SETTINGS_PAGES = 8;

// The names with a hyphen that the HTML standard keeps for SVG and MathML. customElements.define refuses them.
const RESERVED_ELEMENT_NAMES: ReadonlySet<string> = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
]);

// A path on the origin of the web app, so that the page script obeys the script-src 'self' of the web app. It refuses a URL with a scheme, a URL without one (//host/x.js), a backslash and a dot segment. It refuses a percent sign too, because a browser reads %2e%2e as a dot segment.
const isOwnPath = (raw: string): boolean =>
  raw.startsWith('/') &&
  !raw.startsWith('//') &&
  !raw.includes('\\') &&
  !/[\s?#%]/.test(raw) &&
  !raw.split('/').some((segment) => segment === '.' || segment === '..');

const customSettingsPageSchema = z.object({
  id: z
    .string()
    .max(MAX_ID_LENGTH)
    .regex(
      new RegExp(`^${SLUG_SHAPE}$`),
      'is a slug of lowercase letters, digits and single hyphens, as in handbook',
    ),
  label: z.string().trim().min(1).max(40),
  group: z.enum(CUSTOM_SETTINGS_PAGE_GROUPS).default('workspace'),
  roles: z
    .array(z.enum(WORKSPACE_ROLE_NAMES))
    .min(1)
    .default(['owner', 'admin']),
  script: z
    .string()
    .refine(isOwnPath, 'is a path on this origin, as in /handbook/element.js'),
  element: z
    .string()
    .regex(
      /^[a-z][a-z0-9]*-[a-z0-9-]*$/,
      'is a custom element name, as in x-handbook-page',
    )
    .refine(
      (name) => !RESERVED_ELEMENT_NAMES.has(name),
      'is a name that the HTML standard keeps for its own elements, so no script can define it. Please choose another, as in x-handbook-page',
    ),
});

export type CustomSettingsPage = z.infer<typeof customSettingsPageSchema>;

// SPOTLIGHT_CUSTOM_SETTINGS_PAGES: a JSON array of the pages that the deployment adds to the settings of the web app. Each page is a custom element that a script on this origin defines.
export const customSettingsPagesSchema = z
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
          'is a JSON array of custom settings pages, as in [{"id":"handbook","label":"Handbook","script":"/handbook/element.js","element":"x-handbook-page"}]',
      });
      return z.NEVER;
    }
  })
  .pipe(
    z
      .array(customSettingsPageSchema)
      .max(MAX_CUSTOM_SETTINGS_PAGES)
      .refine(
        (pages) => new Set(pages.map((each) => each.id)).size === pages.length,
        'gives each custom settings page its own id',
      )
      .refine(
        (pages) =>
          new Set(pages.map((each) => each.element)).size === pages.length,
        'gives each custom settings page its own element',
      ),
  );
