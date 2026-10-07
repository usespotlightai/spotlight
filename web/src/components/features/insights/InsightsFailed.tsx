import { MembersOnlyOrCouldNotLoad } from '@/components/features/team/MembersOnlyOrCouldNotLoad';

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
      <MembersOnlyOrCouldNotLoad
        membersOnly="Only team members can see Insights"
        what={what}
        query={query}
      />
    </div>
  );
}
