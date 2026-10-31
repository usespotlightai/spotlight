import type { HarnessResponseDto } from '@/lib/api';
import type { PendingAttachment } from '@/lib/attachment';
import type { Reference } from '@/lib/chat-input';
import { fileOfThumbnail } from '@/lib/thumbnail';

export const CHAT_DRAFTS_KEY = 'spotlight.chat-drafts';

export const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const DRAFT_LIMIT = 20;
export const UPLOAD_MAX_AGE_MS = 20 * 60 * 60 * 1000;

export type DraftAttachment = {
  readonly key: string;
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly image: boolean;
  readonly uploadedAt: number;
  readonly thumbnail: string | null;
};

export type DraftSettings = {
  readonly harness?: string;
  readonly model?: string;
  readonly effort?: string;
  readonly repositories?: readonly string[];
};

export type ChatDraft = DraftSettings & {
  readonly text: string;
  readonly references: readonly Reference[];
  readonly attachments: readonly DraftAttachment[];
  readonly savedAt: number;
  readonly prefill: string;
};

export type ChatDrafts = Readonly<Record<string, ChatDraft>>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isReference = (value: unknown): value is Reference =>
  isObject(value) &&
  (value.kind === 'file' ||
    value.kind === 'trace' ||
    value.kind === 'station') &&
  isText(value.key) &&
  isText(value.name);

const isAttachment = (value: unknown): value is DraftAttachment =>
  isObject(value) &&
  isText(value.key) &&
  isText(value.id) &&
  isText(value.name) &&
  typeof value.size === 'number' &&
  typeof value.image === 'boolean' &&
  typeof value.uploadedAt === 'number' &&
  (value.thumbnail === null || isText(value.thumbnail));

const optionalText = (value: unknown): value is string | undefined =>
  value === undefined || isText(value);

const isDraft = (value: unknown): value is ChatDraft =>
  isObject(value) &&
  isText(value.text) &&
  isText(value.prefill) &&
  typeof value.savedAt === 'number' &&
  Array.isArray(value.references) &&
  value.references.every(isReference) &&
  Array.isArray(value.attachments) &&
  value.attachments.every(isAttachment) &&
  optionalText(value.harness) &&
  optionalText(value.model) &&
  optionalText(value.effort) &&
  (value.repositories === undefined ||
    (Array.isArray(value.repositories) && value.repositories.every(isText)));

export const parseDrafts = (raw: string | null): ChatDrafts => {
  try {
    const parsed: unknown = JSON.parse(raw ?? '{}');

    const drafts: Record<string, ChatDraft> = {};

    for (const [key, each] of Object.entries(isObject(parsed) ? parsed : {})) {
      if (isDraft(each)) {
        drafts[key] = each;
      }
    }

    return drafts;
  } catch {
    return {};
  }
};

export const pruneDrafts = (drafts: ChatDrafts, now: number): ChatDrafts =>
  Object.fromEntries(
    Object.entries(drafts)
      .filter(([, each]) => now - each.savedAt <= DRAFT_MAX_AGE_MS)
      .sort(([, a], [, b]) => b.savedAt - a.savedAt)
      .slice(0, DRAFT_LIMIT),
  );

export const prefillSignature = (prefill: {
  readonly text?: string | null;
  readonly references: readonly Reference[];
  readonly repositories?: readonly string[];
  readonly setup?: unknown;
}): string => {
  const { text, references, repositories = [], setup } = prefill;

  return text || references.length > 0 || repositories.length > 0 || setup
    ? JSON.stringify([text ?? '', references, repositories, setup ?? null])
    : '';
};

const hasSettings = (draft: DraftSettings): boolean =>
  draft.harness !== undefined ||
  draft.model !== undefined ||
  draft.effort !== undefined ||
  draft.repositories !== undefined;

export const isEmptyDraft = (draft: ChatDraft): boolean =>
  !draft.text &&
  draft.references.length === 0 &&
  draft.attachments.length === 0 &&
  draft.prefill === '' &&
  !hasSettings(draft);

export const withoutContent = (draft: ChatDraft): ChatDraft => ({
  ...draft,
  text: '',
  references: [],
  attachments: [],
});

export const expiredUploads = (
  attachments: readonly DraftAttachment[],
  now: number,
) => {
  const fresh = (each: DraftAttachment) =>
    now - each.uploadedAt <= UPLOAD_MAX_AGE_MS;

  return {
    kept: attachments.filter(fresh),
    expired: attachments.filter((each) => !fresh(each)),
  };
};

export const validSettings = (
  saved: DraftSettings,
  harnesses: readonly HarnessResponseDto[],
  fallbackHarness: string,
) => {
  const harness = harnesses.some((each) => each.id === saved.harness)
    ? (saved.harness ?? fallbackHarness)
    : fallbackHarness;
  const offered = harnesses.find((each) => each.id === harness);
  const model = offered?.models.some((each) => each.id === saved.model)
    ? (saved.model ?? '')
    : '';
  const effort = offered?.efforts.includes(saved.effort ?? '')
    ? (saved.effort ?? '')
    : '';

  return { harness, model, effort };
};

export const restoredAttachments = (
  saved: readonly DraftAttachment[],
): PendingAttachment[] =>
  saved.map((each) => ({
    key: each.key,
    name: each.name,
    size: each.size,
    image:
      each.image && each.thumbnail
        ? fileOfThumbnail(each.thumbnail, each.name)
        : null,
    state: 'ready',
    id: each.id,
    uploadedAt: each.uploadedAt,
  }));
