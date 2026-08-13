import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

/** Organizations & multi-tenancy (Sprint 8.4). Prisma is @Global; nothing else
 *  is needed. `OrganizationService.requireMember` is exported so future org-
 *  scoped features can enforce the same tenant isolation. */
@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
