import { SkeletonLine } from '@/components/shared/skeleton/SkeletonLine';

export function SettingRowsSkeleton({ rows }: { rows: readonly string[] }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map((row) => (
        <div key={row} className="contents">
          <SkeletonLine className="w-16" />
          <SkeletonLine className="w-28" />
        </div>
      ))}
    </div>
  );
}
