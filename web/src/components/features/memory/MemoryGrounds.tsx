import { useState } from 'react';
import { MemoryGroundList } from '@/components/features/memory/MemoryGroundList';
import { DisclosureToggle } from '@/components/shared/DisclosureToggle';
import { Unfold } from '@/components/shared/Unfold';
import { citesAnything, type MemoryGround } from '@/lib/memory';

type MemoryGroundsProps = {
  grounds: MemoryGround;
};

export function MemoryGrounds({ grounds }: MemoryGroundsProps) {
  const [open, setOpen] = useState(false);

  if (!citesAnything(grounds)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <DisclosureToggle open={open} onToggle={() => setOpen((was) => !was)}>
        Source
      </DisclosureToggle>

      <Unfold open={open} appear={false}>
        <MemoryGroundList grounds={grounds} />
      </Unfold>
    </div>
  );
}
