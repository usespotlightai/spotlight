import { GradeNotSaved } from '@/components/features/inbox/grades/GradeNotSaved';
import { Button } from '@/components/ui/button';
import {
  type Grade,
  type GradeValue,
  gradeOptions,
  type RatedKind,
  scoreShown,
  valueOfGrade,
  YOUR_GRADE,
} from '@/lib/judge';

type QuickGradeProps = {
  kind: RatedKind;
  mine: Grade | null;
  pending: boolean;
  failed: boolean;
  onGrade: (value: GradeValue) => void;
};

export function QuickGrade({
  kind,
  mine,
  pending,
  failed,
  onGrade,
}: QuickGradeProps) {
  return (
    <section
      data-slot="quick-grade"
      aria-label={YOUR_GRADE}
      className="flex flex-col gap-2"
    >
      <h3 className="font-medium text-foreground text-sm">
        {kind === 'yes-no'
          ? 'Is this a good run?'
          : 'How good is this run, from 1 to 5?'}
      </h3>

      <div className="flex flex-wrap gap-2">
        {gradeOptions(kind).map((option) => {
          const chosen =
            mine !== null && mine.value === valueOfGrade(kind, option.value);

          return (
            <Button
              key={option.label}
              type="button"
              size="sm"
              variant={chosen ? 'default' : 'outline'}
              aria-pressed={chosen}
              disabled={pending}
              className="min-w-12 rounded-full"
              onClick={() => onGrade(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {mine && (
        <p className="text-muted-foreground text-xs">
          You graded it {scoreShown(mine).toLowerCase()}. Grade it again to
          change your mind.
        </p>
      )}

      {failed && <GradeNotSaved />}
    </section>
  );
}
