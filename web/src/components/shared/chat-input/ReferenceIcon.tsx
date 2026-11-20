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

import { isCode, type Reference } from '@/lib/chat-input';
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

const BY_EXTENSION: Record<string, LucideIcon> = Object.fromEntries(
  FORMATS.flatMap(([icon, extensions]) =>
    extensions.map((extension) => [extension, icon]),
  ),
);

const extensionOf = (name: string): string =>
  name.slice(name.lastIndexOf('.') + 1).toLowerCase();

const iconOf = (reference: Reference): LucideIcon => {
  if (reference.kind !== 'file') return ICON[reference.kind];
  return (
    BY_EXTENSION[extensionOf(reference.name)] ??
    (isCode(reference.name) ? Braces : ICON.file)
  );
};

const isPlainCode = (reference: Reference): boolean =>
  reference.kind === 'file' &&
  !(extensionOf(reference.name) in BY_EXTENSION) &&
  isCode(reference.name);

const renderIcon = (reference: Reference) => {
  const Icon = iconOf(reference);

  return (
    <Icon
      aria-hidden
      className={cn(
        'size-3.5 shrink-0 self-center',
        isPlainCode(reference) ? 'text-amber-500' : TINT[reference.kind],
      )}
    />
  );
};

export function ReferenceIcon({ reference }: { reference: Reference }) {
  return renderIcon(reference);
}
