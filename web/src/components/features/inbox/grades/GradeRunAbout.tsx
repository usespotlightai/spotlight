export function GradeRunAbout() {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-medium text-foreground text-sm leading-6">
        Grade this run
      </h2>
      <p className="text-muted-foreground text-sm leading-6">
        A judge scored this run against the station’s rubric. Grade it too, so
        the team can see how often the judge agrees with people. Anyone on the
        team can grade it, and nothing waits on it.
      </p>
    </div>
  );
}
