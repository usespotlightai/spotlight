import { OpenInEditor } from '@/components/features/editor/OpenInEditor';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';
import type { TeamRun } from '@/lib/run';

type RunHeaderProps = {
  slug: string;
  run: TeamRun;
  trail: readonly BreadcrumbSegment[];
};

export function RunHeader({ slug, run, trail }: RunHeaderProps) {
  return (
    <PageHeader
      title={<Breadcrumbs segments={trail} />}
      actions={
        run.taskId && (
          <OpenInEditor slug={slug} target={{ kind: 'task', id: run.taskId }} />
        )
      }
    />
  );
}
