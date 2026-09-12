import { InvalidAttachmentError } from '@domain/exceptions/invalid-attachment.error';
import { AttachmentId } from '@domain/value-objects/attachment-id.vo';

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const MAX_NAME = 200;

const CONTENT_TYPE = /^[\w.+-]+\/[\w.+-]+$/;

const UNNAMEABLE = 'application/octet-stream';

const named = (raw: string): string =>
  (raw.split(/[\\/]/).pop() ?? '')
    // biome-ignore lint/suspicious/noControlCharactersInRegex: what a file name must not carry
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(-MAX_NAME)
    .replace(/^\.+/, '')
    .trim();

export class Attachment {
  private constructor(
    readonly id: AttachmentId,
    readonly name: string,
    readonly contentType: string,
    readonly size: number,
  ) {}

  static of(input: {
    id: string;
    name: string;
    contentType?: string | null;
    size: number;
  }): Attachment {
    const id = AttachmentId.of(input.id);
    const name = named(input.name);

    if (!name) {
      throw new InvalidAttachmentError('must have a name');
    }
    if (!Number.isInteger(input.size) || input.size < 0) {
      throw new InvalidAttachmentError('must say how large it is');
    }
    if (Attachment.tooLarge(input.size)) {
      throw new InvalidAttachmentError('must be no larger than 25 MB');
    }

    const type = input.contentType?.trim().toLowerCase() ?? '';

    return new Attachment(
      id,
      name,
      CONTENT_TYPE.test(type) ? type : UNNAMEABLE,
      input.size,
    );
  }

  static rehydrate(input: {
    id: string;
    name: string;
    contentType: string;
    size: number;
  }): Attachment {
    return new Attachment(
      AttachmentId.of(input.id),
      input.name,
      input.contentType,
      input.size,
    );
  }

  static tooLarge(size: number): boolean {
    return size > MAX_ATTACHMENT_BYTES;
  }

  get image(): boolean {
    return this.contentType.startsWith('image/');
  }

  equals(other: Attachment): boolean {
    return (
      this.id.equals(other.id) &&
      this.name === other.name &&
      this.contentType === other.contentType &&
      this.size === other.size
    );
  }
}
