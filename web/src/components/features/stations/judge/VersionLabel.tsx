import { ExternalTextLink } from '@/components/shared/ExternalTextLink';
import {
  CURRENT_VERSION,
  formatRubric,
  type RubricVersion,
  versionLinkOf,
} from '@/lib/judge';

export function VersionLabel({ version }: { version: RubricVersion }) {
  const link = versionLinkOf(version.source);

  if (!link) {
    return formatRubric(version);
  }

  return (
    <span data-slot="version-label" className="inline-flex gap-2">
      <ExternalTextLink
        href={link.href}
        title={link.title}
        className="tabular-nums"
      >
        {link.label}
      </ExternalTextLink>
      {version.current && (
        <span className="text-muted-foreground">{CURRENT_VERSION}</span>
      )}
    </span>
  );
}
