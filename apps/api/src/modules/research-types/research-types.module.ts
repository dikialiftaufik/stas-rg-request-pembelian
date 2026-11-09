import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ResearchTypesController } from './research-types.controller';
import { ResearchTypesService } from './research-types.service';
import { ResearchUsageProvider } from './research-usage.provider';

@Module({
  imports: [AuthModule],
  controllers: [ResearchTypesController],
  providers: [ResearchTypesService, ResearchUsageProvider],
  exports: [ResearchTypesService, ResearchUsageProvider],
})
export class ResearchTypesModule {}
