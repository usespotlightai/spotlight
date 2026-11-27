import {
  Binoculars,
  Braces,
  Database,
  FileArchive,
  FileAudio,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Image,
  type LucideIcon,
  MousePointer2,
  ScrollText,
  Terminal,
} from 'lucide-react';
import { createElement, type ReactElement } from 'react';

import { extensionOf, isCode, type Reference } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

const ICON: Record<Reference['kind'], LucideIcon> = {
  file: FileText,
  trace: Binoculars,
  station: MousePointer2,
};

const TINT: Record<Reference['kind'], string> = {
  file: 'text-muted-foreground',
  trace: 'text-primary',
  station: 'text-primary',
};

const FORMATS: [LucideIcon, string[]][] = [
  [FileVideo, ['mov', 'mp4', 'webm', 'mkv']],
  [FileAudio, ['mp3', 'wav', 'm4a', 'ogg']],
  [Image, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']],
  [FileArchive, ['zip', 'tar', 'gz', '7z']],
  [FileSpreadsheet, ['csv', 'tsv', 'xlsx']],
  [FileJson, ['json', 'yaml', 'yml', 'toml']],
  [ScrollText, ['log']],
  [Terminal, ['sh', 'bash']],
  [Database, ['sql', 'sqlite']],
];

const BY_EXTENSION = new Map<string, LucideIcon>(
  FORMATS.flatMap(([icon, extensions]) =>
    extensions.map((extension): [string, LucideIcon] => [extension, icon]),
  ),
);

const iconOf = (reference: Reference): LucideIcon => {
  if (reference.kind !== 'file') return ICON[reference.kind];
  return (
    BY_EXTENSION.get(extensionOf(reference.name)) ??
    (isCode(reference.name) ? Braces : ICON.file)
  );
};

const isPlainCode = (reference: Reference): boolean =>
  reference.kind === 'file' &&
  !BY_EXTENSION.has(extensionOf(reference.name)) &&
  isCode(reference.name);

export function ReferenceIcon({
  reference,
}: {
  reference: Reference;
}): ReactElement {
  return createElement(iconOf(reference), {
    'aria-hidden': true,
    className: cn(
      'size-3.5 shrink-0 self-center',
      isPlainCode(reference) ? 'text-amber-500' : TINT[reference.kind],
    ),
  });
}
