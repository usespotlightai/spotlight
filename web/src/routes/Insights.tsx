import type { ReactElement } from 'react';
import { useParams, useSearchParams } from 'react-router';

import { InsightsPeriodPicker } from '@/components/features/insights/InsightsPeriodPicker';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { TracesFilters } from '@/components/features/insights/TracesFilters';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { insightsCrumbs, viewOf } from '@/lib/insights';

export function Insights(): ReactElement | null {
  const { slug, teamId } = useParams();
  const [params] = useSearchParams();
  const view = viewOf(params);

  if (
    slug === undefined ||
    slug === '' ||
    teamId === undefined ||
    teamId === ''
  ) {
    return null;
  }

  return (
    <TeamSectionPage
      section="insights"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view.tab === 'traces' && (
            <div className="hidden @2xl/pane:contents">
              <TracesFilters teamId={teamId} />
            </div>
          )}
          <InsightsPeriodPicker />
        </div>
      }
      bordered={false}
      crumbs={insightsCrumbs(view)}
    >
      <TeamInsights slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
