import type { AttachmentResponseDto } from '@/lib/api';

export type Attachment = AttachmentResponseDto;

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type PendingAttachment = {
  readonly key: string;
  readonly name: string;
  readonly size: number;
  readonly image: File | null;
} & (
  | { readonly state: 'uploading' }
  | { readonly state: 'ready'; readonly id: string }
  | { readonly state: 'failed'; readonly problem: string }
);

export const attachmentPath = (slug: string, attachmentId: string): string =>
  `/api/workspaces/${slug}/attachments/${encodeURIComponent(attachmentId)}`;

export const downloadPath = (slug: string, attachmentId: string): string =>
  `${attachmentPath(slug, attachmentId)}?download=1`;

const DRAWN = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);

export const drawn = (contentType: string): boolean => DRAWN.has(contentType);

const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export const sized = (bytes: number): string => {
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }

  const shown =
    unit === 0 || value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;

  return `${shown} ${UNITS[unit]}`;
};

export const refused = (file: { readonly size: number }): string | null =>
  file.size > MAX_ATTACHMENT_BYTES
    ? `The file is too large. Maximum size: ${sized(MAX_ATTACHMENT_BYTES)}`
    : null;

export const filesIn = (carried: DataTransfer | null): File[] =>
  carried ? Array.from(carried.files) : [];
