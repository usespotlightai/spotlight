import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { Notice } from '@/components/shared/Notice';
import {
  type BreadcrumbSegment,
  Breadcrumbs,
} from '@/components/shell/layout/Breadcrumbs';
import { PageHeader } from '@/components/shell/layout/PageHeader';

type TaskCouldNotLoadProps = {
  known: readonly BreadcrumbSegment[];
  retrying: boolean;
  onRetry: () => void;
};

export function TaskCouldNotLoad({
  known,
  retrying,
  onRetry,
}: TaskCouldNotLoadProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={<Breadcrumbs segments={[...known, { label: 'Task' }]} />}
        heading={false}
      />

      <Notice>
        <CouldNotLoad what="The task" retrying={retrying} onRetry={onRetry} />
      </Notice>
    </div>
  );
}
