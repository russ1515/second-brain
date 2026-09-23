import { Injectable } from '@nestjs/common';
import type { HealthState } from '@second-brain/shared';
import { QdrantService } from '../../qdrant/qdrant.service';

@Injectable()
export class QdrantHealthIndicator {
  constructor(private readonly qdrant: QdrantService) {}

  async check(): Promise<{ status: HealthState; message?: string }> {
    try {
      await this.qdrant.listCollections();
      return { status: 'up' };
    } catch {
      // The public health route reports component availability, never a raw
      // provider exception or Qdrant connection detail.
      return { status: 'down' };
    }
  }
}
