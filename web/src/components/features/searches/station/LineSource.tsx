import { GitBranch } from 'lucide-react';
import type { LineSourceResponseDto } from '@/lib/api';

type LineSourceProps = {
  source: LineSourceResponseDto | null;
};

export function LineSource({ source }: LineSourceProps) {
  return (
    <p
      data-slot="line-source"
      className="flex min-w-0 items-start gap-1.5 text-muted-foreground text-xs leading-5"
    >
      <GitBranch aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      {source ? (
        <span className="min-w-0">
          A picked candidate opens a pull request against{' '}
          <code className="font-mono text-foreground">{source.repository}</code>{' '}
          at{' '}
          <code className="break-all font-mono text-foreground">
            {source.path}
          </code>
        </span>
      ) : (
        <span className="min-w-0">
          Line names no Terraform source. A picked candidate can’t open a pull
          request. Please give the line a source in Terraform.
        </span>
      )}
    </p>
  );
}
