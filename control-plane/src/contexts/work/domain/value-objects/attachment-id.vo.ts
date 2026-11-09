import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class AttachmentId {
  private constructor(readonly value: string) {}

  static of(raw: string): AttachmentId {
    const value = raw.trim();

    if (!ID.test(value)) {
      throw new InvalidAttachmentError('id must not be empty');
    }

    return new AttachmentId(value);
  }

  static parsed(raw: string): AttachmentId | null {
    const value = raw.trim();

    return ID.test(value) ? new AttachmentId(value) : null;
  }

  equals(other: AttachmentId): boolean {
    return this.value === other.value;
  }
}
