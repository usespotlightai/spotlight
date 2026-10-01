import { settingsPath } from '@/lib/team';

const ANCHOR = 'skill-';

export const skillAnchor = (key: string): string => `${ANCHOR}${key}`;

export const skillPath = (slug: string, teamId: string, key: string): string =>
  `${settingsPath(slug, teamId, 'skills')}#${skillAnchor(key)}`;

export const pointedSkill = (hash: string): string | null => {
  const anchor = decodeURIComponent(hash.replace(/^#/, ''));

  return anchor.startsWith(ANCHOR) ? anchor.slice(ANCHOR.length) : null;
};
