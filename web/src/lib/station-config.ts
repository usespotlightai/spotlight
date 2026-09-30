import type { ConfigChangeResponseDto } from '@/lib/api';
import { imageShown } from '@/lib/run';

export type ConfigChange = ConfigChangeResponseDto;

const SHORT_FINGERPRINT = 8;

export const shortFingerprint = (fingerprint: string): string =>
  fingerprint.slice(0, SHORT_FINGERPRINT);

const PART_LABELS: Record<ConfigChange['part'], string> = {
  prompt: 'Prompt',
  harness: 'Harness',
  model: 'Model',
  effort: 'Effort',
  profile: 'Profile',
  image: 'Image',
  repository: 'Repository',
  skill: 'Skill',
  tool: 'Tool',
  decisions: 'Decisions',
  memories: 'Memories',
};

const SWITCHES: readonly ConfigChange['part'][] = ['decisions', 'memories'];

const CHANGED_WITHIN: Partial<Record<ConfigChange['part'], string>> = {
  repository: 'setup changed',
  profile: 'settings changed',
};

const shownValue = (
  part: ConfigChange['part'],
  value: string | null,
): string | null => (value && part === 'image' ? imageShown(value) : value);

const namedPhrase = (change: ConfigChange, label: string, name: string) =>
  change.kind === 'changed'
    ? `${label} ${name} ${CHANGED_WITHIN[change.part] ?? 'changed'}`
    : `${label} ${name} ${change.kind}`;

const valuePhrase = (change: ConfigChange, label: string): string => {
  const was = shownValue(change.part, change.was);
  const now = shownValue(change.part, change.now);

  if (change.kind === 'added') {
    return now ? `${label} set to ${now}` : `${label} added`;
  }
  if (change.kind === 'removed') {
    return was ? `${label} ${was} removed` : `${label} removed`;
  }

  return was && now ? `${label} ${was} → ${now}` : `${label} changed`;
};

export const changePhrase = (change: ConfigChange): string => {
  const label = PART_LABELS[change.part];

  if (SWITCHES.includes(change.part)) {
    return `${label} ${change.now ?? 'off'}`;
  }

  return change.name
    ? namedPhrase(change, label, change.name)
    : valuePhrase(change, label);
};
