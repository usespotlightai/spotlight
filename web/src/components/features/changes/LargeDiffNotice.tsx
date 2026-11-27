import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/utils';

type LargeDiffNoticeProps = {
  lines: number;
  onLoad: () => void;
};

export function LargeDiffNotice({ lines, onLoad }: LargeDiffNoticeProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
      <p className="text-muted-foreground text-xs">
        This large diff isn’t shown. Lines changed: {lines.toLocaleString('en')}
      </p>
      <button
        type="button"
        onClick={onLoad}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'rounded-full bg-card shadow-none',
        )}
      >
        Load diff
      </button>
    </div>
  );
}
