import { ImproveStation } from '@replays/application/rendering/improve-station';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const STATION = {
  lineKey: 'delivery',
  lineName: 'Delivery',
  key: 'review',
  name: 'Code Review',
};

describe('ImproveStation', () => {
  it('says where the Terraform of the line is, so the agent looks for it before it says it is not checked out', () => {
    const section = ImproveStation.section('Code Review', {
      ...STATION,
      source: {
        repository: Repository.of('acme/platform'),
        path: 'spotlight/delivery.tf',
      },
    });

    expect(section).toContain(
      'The Terraform of this line is `spotlight/delivery.tf` in the `acme/platform` repository.',
    );
    expect(section).toContain(
      "Look for that path there, and read the station's block and the line's `search` settings, before you say that the Terraform is not checked out.",
    );
  });

  it('shows the station block as it should read when the line does not say where its Terraform is', () => {
    expect(
      ImproveStation.section('Code Review', { ...STATION, source: null }),
    ).toContain(
      "If the team's Terraform is not checked out, show the station block as it should read.",
    );
  });
});
