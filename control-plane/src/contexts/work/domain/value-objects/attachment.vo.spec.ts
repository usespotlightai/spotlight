import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import {
  Attachment,
  MAX_ATTACHMENT_BYTES,
} from '@work/domain/value-objects/attachment.vo';
import { describe, expect, it } from 'vitest';

const file = (overrides: Partial<Parameters<typeof Attachment.of>[0]> = {}) =>
  Attachment.of({
    id: 'file_1',
    name: 'queue.png',
    contentType: 'image/png',
    size: 4096,
    ...overrides,
  });

describe('Attachment', () => {
  it('keeps only the last part of a path it arrived with', () => {
    expect(file({ name: '../../etc/passwd' }).name).toBe('passwd');
    expect(file({ name: 'C:\\Users\\ada\\queue.png' }).name).toBe('queue.png');
  });

  it('drops what a directory name cannot contain, leading dots included', () => {
    expect(file({ name: '.\u0000hidden\u001f.log' }).name).toBe('hidden.log');
  });

  it('keeps the extension of a name too long to keep whole', () => {
    const named = file({ name: `${'a'.repeat(300)}.png` }).name;

    expect(named).toHaveLength(200);
    expect(named.endsWith('.png')).toBe(true);
  });

  it('refuses a name that is nothing once cleaned', () => {
    expect(() => file({ name: '...' })).toThrow(InvalidAttachmentError);
  });

  it('refuses an id that could name somewhere else', () => {
    expect(() => file({ id: '../file_2' })).toThrow(InvalidAttachmentError);
    expect(() => file({ id: '' })).toThrow(InvalidAttachmentError);
  });

  it('refuses a file larger than the most one may weigh', () => {
    expect(file({ size: MAX_ATTACHMENT_BYTES }).size).toBe(
      MAX_ATTACHMENT_BYTES,
    );
    expect(() => file({ size: MAX_ATTACHMENT_BYTES + 1 })).toThrow(
      'must be no larger than 25 MB',
    );
  });

  it('refuses a size that is not a count of bytes', () => {
    expect(() => file({ size: -1 })).toThrow(InvalidAttachmentError);
    expect(() => file({ size: 1.5 })).toThrow(InvalidAttachmentError);
  });

  it('calls a type it cannot read nameless bytes', () => {
    expect(file({ contentType: '' }).contentType).toBe(
      'application/octet-stream',
    );
    expect(file({ contentType: 'not a type' }).contentType).toBe(
      'application/octet-stream',
    );
    expect(file({ contentType: 'Image/PNG' }).contentType).toBe('image/png');
  });

  it('is the same file only where nothing about it differs', () => {
    expect(file().equals(file())).toBe(true);
    expect(file().equals(file({ name: 'renamed.png' }))).toBe(false);
    expect(file().equals(file({ size: 8192 }))).toBe(false);
    expect(file().equals(file({ id: 'file_2' }))).toBe(false);
  });

  it('reads back what was kept, whatever today\u2019s rules say', () => {
    const kept = Attachment.rehydrate({
      id: 'file_1',
      name: '.hidden name',
      contentType: 'application/x-made-up',
      size: MAX_ATTACHMENT_BYTES * 2,
    });

    expect(kept.name).toBe('.hidden name');
    expect(kept.contentType).toBe('application/x-made-up');
    expect(kept.size).toBe(MAX_ATTACHMENT_BYTES * 2);
  });

  it('says whether a size may be kept at all', () => {
    expect(Attachment.tooLarge(MAX_ATTACHMENT_BYTES)).toBe(false);
    expect(Attachment.tooLarge(MAX_ATTACHMENT_BYTES + 1)).toBe(true);
  });

  it('is shown as a picture only where it is one', () => {
    expect(file().image).toBe(true);
    expect(file({ contentType: 'application/pdf' }).image).toBe(false);
  });
});
