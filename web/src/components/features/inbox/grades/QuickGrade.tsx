import { GradeOptionButton } from '@/components/features/inbox/grades/GradeOptionButton';
import {
  type Grade,
  type GradeValue,
  gradeOptions,
  type RatedKind,
  valueOfGrade,
  YOUR_GRADE,
} from '@/lib/judge';

type QuickGradeProps = {
  kind: RatedKind;
  mine: Grade | null;
  pending: boolean;
  onGrade: (value: GradeValue) => void;
};

export function QuickGrade({ kind, mine, pending, onGrade }: QuickGradeProps) {
  return (
    <section
      data-slot="quick-grade"
      aria-label={YOUR_GRADE}
      className="flex flex-wrap items-center gap-2"
    >
      {gradeOptions(kind).map((option) => (
        <GradeOptionButton
          key={option.label}
          label={option.label}
          chosen={
            mine !== null && mine.value === valueOfGrade(kind, option.value)
          }
          pending={pending}
          onClick={() => onGrade(option.value)}
        />
      ))}
    </section>
  );
}
