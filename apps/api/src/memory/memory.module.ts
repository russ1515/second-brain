import { Module } from '@nestjs/common';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

/** Learning Memory Engine (task 4.2): the unified pedagogical memory. Read-only
 *  aggregation over what the app already persists — needs only PrismaService
 *  (global), so no other imports. */
@Module({
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
