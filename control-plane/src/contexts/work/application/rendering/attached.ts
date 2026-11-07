import type { AttachmentShape } from '@runs/application/contracts/run-spec.contract';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';

const PLACED = '.spotlight/attachments/';

const placed = (attachment: Attachment): string =>
  `${PLACED}${attachment.id.value}/${attachment.name}`;

const KB = 1024;
const MB = KB * KB;

const sized = (bytes: number): string =>
  bytes < KB
    ? `${bytes} B`
    : bytes < MB
      ? `${Math.round(bytes / KB)} KB`
      : `${(bytes / MB).toFixed(1)} MB`;

export const Attached = {
  idIn(reference: string): AttachmentId {
    const trimmed = reference.trim();
    const at = trimmed.indexOf(PLACED);

    if (at < 0 && trimmed.includes('/')) {
      throw new InvalidAttachmentError(
        `${trimmed} is not under ${PLACED.slice(0, -1)}`,
      );
    }

    return AttachmentId.of(
      at < 0
        ? trimmed
        : (trimmed.slice(at + PLACED.length).split('/')[0] ?? ''),
    );
  },

  shapes(attachments: readonly Attachment[]): AttachmentShape[] {
    return attachments.map((each) => ({
      id: each.id.value,
      path: placed(each),
    }));
  },

  listed(attachments: readonly Attachment[]): string | null {
    return attachments.length > 0
      ? [
          'Attached, in the workspace:',
          ...attachments.map(
            (each) =>
              `- \`${placed(each)}\` (${each.contentType}, ${sized(each.size)})`,
          ),
        ].join('\n')
      : null;
  },

  beside(body: string, attachments: readonly Attachment[]): string {
    return [body, Attached.listed(attachments)].filter(Boolean).join('\n\n');
  },
};
