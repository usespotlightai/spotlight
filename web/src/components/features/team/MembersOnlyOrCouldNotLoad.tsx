import { MembersOnly } from '@/components/features/team/MembersOnly';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { notFound } from '@/lib/error';

type MembersOnlyOrCouldNotLoadProps = {
  membersOnly: string;
  what: string;
  query: {
    error: unknown;
    isFetching: boolean;
    refetch: () => unknown;
  };
};

export function MembersOnlyOrCouldNotLoad({
  membersOnly,
  what,
  query,
}: MembersOnlyOrCouldNotLoadProps) {
  return notFound(query.error) ? (
    <MembersOnly title={membersOnly} />
  ) : (
    <CouldNotLoad
      what={what}
      retrying={query.isFetching}
      onRetry={() => void query.refetch()}
    />
  );
}
