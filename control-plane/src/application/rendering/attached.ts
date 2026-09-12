import type { AttachmentShape } from '@application/contracts/run-spec.contract';
import type { Attachment } from '@domain/value-objects/attachment.vo';

const placed = (attachment: Attachment): string =>
  `.spotlight/attachments/${attachment.id.value}/${attachment.name}`;

const KB = 1024;
const MB = KB * KB;

const sized = (bytes: number): string =>
  bytes < KB
    ? `${bytes} B`
    : bytes < MB
      ? `${Math.round(bytes / KB)} KB`
      : `${(bytes / MB).toFixed(1)} MB`;

export const Attached = {
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
