import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtCookieAuthGuard } from '../../common/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createResearchTypeSchema,
  listResearchTypesQuerySchema,
  updateResearchTypeSchema,
} from './dto/research-type.dto';
import type {
  CreateResearchTypeDto,
  ListResearchTypesQueryDto,
  UpdateResearchTypeDto,
} from './dto/research-type.dto';
import { ResearchTypesService } from './research-types.service';
import type { ResearchTypeItem, ResearchTypeListResponse } from './research-types.types';

@Controller('research-types')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('admin')
export class ResearchTypesController {
  constructor(
    @Inject(ResearchTypesService) private readonly researchTypesService: ResearchTypesService,
  ) {}

  @Get()
  @Roles('admin', 'pengaju')
  async findAll(
    @Query(new ZodValidationPipe(listResearchTypesQuerySchema)) query: ListResearchTypesQueryDto,
  ): Promise<ResearchTypeListResponse> {
    return this.researchTypesService.findAll(query);
  }

  @Get(':id')
  @Roles('admin', 'pengaju')
  async findOne(@Param('id') id: string): Promise<{ data: ResearchTypeItem }> {
    const item = await this.researchTypesService.findOne(id);
    return { data: item };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createResearchTypeSchema)) dto: CreateResearchTypeDto,
  ): Promise<{ data: ResearchTypeItem }> {
    const created = await this.researchTypesService.create(dto);
    return { data: created };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateResearchTypeSchema)) dto: UpdateResearchTypeDto,
  ): Promise<{ data: ResearchTypeItem }> {
    const updated = await this.researchTypesService.update(id, dto);
    return { data: updated };
  }

  @Put(':id')
  async replace(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createResearchTypeSchema)) dto: CreateResearchTypeDto,
  ): Promise<{ data: ResearchTypeItem }> {
    const updated = await this.researchTypesService.update(id, dto);
    return { data: updated };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string): Promise<{ data: { id: string; deleted: true } }> {
    const result = await this.researchTypesService.remove(id);
    return { data: result };
  }
}
