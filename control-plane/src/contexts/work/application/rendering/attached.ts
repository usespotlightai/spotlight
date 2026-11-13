import type { AttachmentShape } from '@runs/application/contracts/run-spec.contract';
import { InvalidAttachmentError } from '@work/domain/exceptions/invalid-attachment.error';
import { AttachmentId } from '@work/domain/value-objects/attachment-id.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';

const PLACED = '.spotlight/attachments/';

const placed = (attachment: Attachment): string =>
  `${PLACED}${attachment.id.value}/${attachment.name}`;

const VIDEO_HINT =
  'To see a video, first get its duration with `ffprobe "<video>"`. Then make a folder, extract at most 60 frames into it as images with `ffmpeg` and read those images. For example: `ffmpeg -i "<video>" -vf fps=1 -frames:v 60 "<folder>/%03d.png"`. For a long video, use a lower rate, such as `fps=1/10`. Put quotes around paths, because attachment names can contain spaces.';

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
    if (attachments.length === 0) {
      return null;
    }

    const listing = [
      'Attached, in the workspace:',
      ...attachments.map(
        (each) =>
          `- \`${placed(each)}\` (${each.contentType}, ${sized(each.size)})`,
      ),
    ].join('\n');

    return attachments.some((each) => each.video)
      ? `${listing}\n\n${VIDEO_HINT}`
      : listing;
  },

  beside(body: string, attachments: readonly Attachment[]): string {
    return [body, Attached.listed(attachments)].filter(Boolean).join('\n\n');
  },
};
