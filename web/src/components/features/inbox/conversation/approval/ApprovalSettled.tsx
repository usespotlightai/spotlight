import type { Approval } from '@/lib/approval';

const settledWords = (approval: Approval): string => {
  if (approval.standing === 'granted') {
    return approval.edited
      ? 'You approved this, with your changes.'
      : 'You approved this.';
  }

  return approval.standing === 'refused'
    ? 'You dismissed this.'
    : 'Waiting on a decision in the inbox.';
};

export function ApprovalSettled({ approval }: { approval: Approval }) {
  return (
    <p className="text-muted-foreground text-sm leading-6">
      {settledWords(approval)}
    </p>
  );
}
