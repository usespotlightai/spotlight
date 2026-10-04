import type { ReactNode } from 'react';

type ApprovalTableProps = {
  as: 'dl' | 'div';
  children: ReactNode;
};

export function ApprovalTable({ as: Table, children }: ApprovalTableProps) {
  return (
    <Table className="[&>*+*]:border-border [&>*+*]:border-t-[0.5px]">
      {children}
    </Table>
  );
}
