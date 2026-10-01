import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { notFound } from '@/lib/error';

type InsightsFailedProps = {
  what: string;
  query: {
    error: unknown;
    isFetching: boolean;
    refetch: () => unknown;
  };
};

export function InsightsFailed({ what, query }: InsightsFailedProps) {
  return (
    <div className="flex justify-center rounded-xl border border-border py-10">
      {notFound(query.error) ? (
        <MembersOnly title="Only the team’s members can see its Insights" />
      ) : (
        <CouldNotLoad
          what={what}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
    </div>
  );
}
