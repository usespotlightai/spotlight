import type {
  ConfigChangeResponseDto,
  StationChangeResponseDto,
} from '@/lib/api';
import { formatImage } from '@/lib/run';

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
  judge: 'Judge',
};

const isConfigPart = (part: string): part is ConfigChange['part'] =>
  Object.hasOwn(PART_LABELS, part);

export const configChangesOf = (
  changes: readonly StationChangeResponseDto[],
): ConfigChange[] =>
  changes.flatMap(({ part, ...rest }) =>
    isConfigPart(part) ? [{ ...rest, part }] : [],
  );

export const CHANGED_WITHIN: Partial<Record<ConfigChange['part'], string>> = {
  repository: 'setup changed',
  profile: 'settings changed',
};

export const shownValue = (
  part: ConfigChange['part'],
  value: string | null,
): string | null => (value && part === 'image' ? formatImage(value) : value);
