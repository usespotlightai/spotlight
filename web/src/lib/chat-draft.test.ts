import { describe, expect, it } from 'vitest';
import type { HarnessResponseDto } from '@/lib/api';
import {
  type ChatDraft,
  DRAFT_LIMIT,
  DRAFT_MAX_AGE_MS,
  expiredUploads,
  isEmptyDraft,
  parseDrafts,
  prefillSignature,
  pruneDrafts,
  UPLOAD_MAX_AGE_MS,
  validSettings,
} from '@/lib/chat-draft';

const NOW = 1_800_000_000_000;

const draft = (overrides: Partial<ChatDraft> = {}): ChatDraft => ({
  text: 'Plan it',
  references: [],
  attachments: [],
  savedAt: NOW,
  prefill: '',
  ...overrides,
});

const HARNESS: HarnessResponseDto = {
  id: 'claude-code',
  name: 'Claude Code',
  models: [{ id: 'opus', name: 'Opus' }],
  defaultModel: 'opus',
  efforts: ['high'],
};

describe('parseDrafts', () => {
  it('reads what it was given', () => {
    expect(parseDrafts(JSON.stringify({ new: draft() }))).toEqual({
      new: draft(),
    });
  });

  it.each([null, '', '{not json', '[]', '"text"'])(
    'gives nothing for %j',
    (raw) => {
      expect(parseDrafts(raw)).toEqual({});
    },
  );

  it('skips a record of the wrong shape and keeps the others', () => {
    const raw = JSON.stringify({
      bad: { text: 1 },
      good: draft(),
    });

    expect(Object.keys(parseDrafts(raw))).toEqual(['good']);
  });
});

describe('pruneDrafts', () => {
  it('drops a draft older than 30 days', () => {
    const pruned = pruneDrafts(
      {
        old: draft({ savedAt: NOW - DRAFT_MAX_AGE_MS - 1 }),
        young: draft(),
      },
      NOW,
    );

    expect(Object.keys(pruned)).toEqual(['young']);
  });

  it('keeps the newest drafts up to the limit', () => {
    const many = Object.fromEntries(
      Array.from({ length: DRAFT_LIMIT + 5 }, (_, at) => [
        `chat:${at}`,
        draft({ savedAt: NOW - at }),
      ]),
    );
    const pruned = pruneDrafts(many, NOW);

    expect(Object.keys(pruned)).toHaveLength(DRAFT_LIMIT);
    expect(pruned['chat:0']).toBeDefined();
    expect(pruned[`chat:${DRAFT_LIMIT + 4}`]).toBeUndefined();
  });
});

describe('prefillSignature', () => {
  it('is empty without a prefill', () => {
    expect(prefillSignature({ references: [] })).toBe('');
  });

  it('differs when the prompt differs', () => {
    expect(prefillSignature({ text: 'a', references: [] })).not.toBe(
      prefillSignature({ text: 'b', references: [] }),
    );
  });

  it('is equal for the same prefill', () => {
    const same = () =>
      prefillSignature({
        text: 'a',
        references: [{ kind: 'trace', key: 't', name: 'T' }],
        repositories: ['acme/api'],
      });

    expect(same()).toBe(same());
  });
});

describe('isEmptyDraft', () => {
  it('holds only for a draft with no content, prefill or settings', () => {
    expect(isEmptyDraft(draft({ text: '' }))).toBe(true);
    expect(isEmptyDraft(draft())).toBe(false);
    expect(isEmptyDraft(draft({ text: '', model: 'opus' }))).toBe(false);
    expect(isEmptyDraft(draft({ text: '', prefill: 'x' }))).toBe(false);
  });
});

describe('expiredUploads', () => {
  it('splits the uploads by age', () => {
    const attachment = (key: string, uploadedAt: number) => ({
      key,
      id: key,
      name: `${key}.txt`,
      size: 1,
      image: false,
      uploadedAt,
      thumbnail: null,
    });
    const { kept, expired } = expiredUploads(
      [attachment('new', NOW), attachment('old', NOW - UPLOAD_MAX_AGE_MS - 1)],
      NOW,
    );

    expect(kept.map((each) => each.key)).toEqual(['new']);
    expect(expired.map((each) => each.key)).toEqual(['old']);
  });
});

describe('validSettings', () => {
  it('keeps settings the harness offers', () => {
    expect(
      validSettings(
        { harness: 'claude-code', model: 'opus', effort: 'high' },
        [HARNESS],
        'other',
      ),
    ).toEqual({ harness: 'claude-code', model: 'opus', effort: 'high' });
  });

  it('falls back where the harness is gone', () => {
    expect(
      validSettings(
        { harness: 'gone', model: 'opus' },
        [HARNESS],
        'claude-code',
      ),
    ).toEqual({ harness: 'claude-code', model: 'opus', effort: '' });
  });

  it('falls back where the harness does not offer the model or effort', () => {
    expect(
      validSettings(
        { harness: 'claude-code', model: 'sonnet', effort: 'max' },
        [HARNESS],
        'claude-code',
      ),
    ).toEqual({ harness: 'claude-code', model: '', effort: '' });
  });
});
