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
} from "lucide-react";

import { isCode, type Reference } from "@/lib/chat-input";
import { cn } from "@/lib/utils";

const ICON: Record<Reference["kind"], LucideIcon> = {
  file: FileText,
  trace: Binoculars,
  station: MousePointer2,
};

const TINT: Record<Reference["kind"], string> = {
  file: "text-muted-foreground",
  trace: "text-primary",
  station: "text-primary",
};

const FORMATS: [LucideIcon, string[]][] = [
  [FileVideo, ["mov", "mp4", "webm", "mkv"]],
  [FileAudio, ["mp3", "wav", "m4a", "ogg"]],
  [Image, ["png", "jpg", "jpeg", "gif", "webp", "svg"]],
  [FileArchive, ["zip", "tar", "gz", "7z"]],
  [FileSpreadsheet, ["csv", "tsv", "xlsx"]],
  [FileJson, ["json", "yaml", "yml", "toml"]],
  [ScrollText, ["log"]],
  [Terminal, ["sh", "bash"]],
  [Database, ["sql", "sqlite"]],
];

const BY_EXTENSION = new Map<string, LucideIcon>(
  FORMATS.flatMap(([icon, extensions]) =>
    extensions.map((extension): [string, LucideIcon] => [extension, icon]),
  ),
);

const extensionOf = (name: string): string =>
  name.slice(name.lastIndexOf(".") + 1).toLowerCase();

export function ReferenceIcon({ reference }: { reference: Reference }) {
  const isFile = reference.kind === "file";
  const format = isFile
    ? BY_EXTENSION.get(extensionOf(reference.name))
    : undefined;
  const code = isFile && !format && isCode(reference.name);
  const Icon = format ?? (code ? Braces : ICON[reference.kind]);

  return (
    <Icon
      aria-hidden
      className={cn(
        "size-3.5 shrink-0 self-center",
        code ? "text-amber-500" : TINT[reference.kind],
      )}
    />
  );
}
