import type { ClipboardEvent, DragEvent } from 'react';
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
  | {
      readonly state: 'ready';
      readonly id: string;
      readonly uploadedAt?: number;
    }
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

export const sizeProblem = (file: { readonly size: number }): string | null =>
  file.size > MAX_ATTACHMENT_BYTES
    ? `The file is too large. Maximum size: ${sized(MAX_ATTACHMENT_BYTES)}`
    : null;

export const carriesFiles = (carried: DataTransfer | null): boolean =>
  Boolean(carried?.types.includes('Files'));

export const filesIn = (carried: DataTransfer | null): File[] => {
  if (!carried) {
    return [];
  }

  if (carried.files.length > 0) {
    return Array.from(carried.files);
  }

  return Array.from(carried.items ?? []).flatMap((item) => {
    const file = item.kind === 'file' ? item.getAsFile() : null;
    return file ? [file] : [];
  });
};

type Take = (files: readonly File[]) => void;

const took = (event: ClipboardEvent | DragEvent, files: File[], take: Take) => {
  if (files.length === 0) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  take(files);
};

export const allowFileDrop = (event: DragEvent) => {
  if (carriesFiles(event.dataTransfer)) {
    event.preventDefault();
  }
};

export const dropFiles = (event: DragEvent, take: Take) => {
  if (carriesFiles(event.dataTransfer)) {
    event.preventDefault();
    event.stopPropagation();
  }
  took(event, filesIn(event.dataTransfer), take);
};

export const pasteFiles = (event: ClipboardEvent, take: Take) =>
  took(event, filesIn(event.clipboardData), take);
