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
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtCookieAuthGuard } from '../../common/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  changeRequestStatusSchema,
  createPurchaseRequestSchema,
  importPurchaseRequestsSchema,
  markNotificationsReadSchema,
  proposeReplacementSchema,
  respondReplacementSchema,
  revisionBodySchema,
  saveInvoiceMetadataSchema,
  updatePurchaseRequestSchema,
  updateSubmissionStatusSchema,
} from './dto/purchase-request.dto';
import type {
  ChangeRequestStatusDto,
  CreatePurchaseRequestDto,
  ImportPurchaseRequestsDto,
  MarkNotificationsReadDto,
  ProposeReplacementDto,
  RespondReplacementDto,
  SaveInvoiceMetadataDto,
  UpdatePurchaseRequestDto,
  UpdateSubmissionStatusDto,
} from './dto/purchase-request.dto';
import { PurchaseRequestsService } from './purchase-requests.service';
import type { UploadedInvoiceFileInput } from './purchase-requests.service';
import type {
  PurchaseRequestImportResult,
  PurchaseRequestItem,
  PurchaseRequestListResponse,
} from './purchase-requests.types';

@Controller('requests')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
export class PurchaseRequestsController {
  constructor(
    @Inject(PurchaseRequestsService)
    private readonly purchaseRequestsService: PurchaseRequestsService,
  ) {}

  @Get()
  @Roles('admin', 'pengaju')
  async findAll(@CurrentUser() actor: AuthenticatedUser): Promise<PurchaseRequestListResponse> {
    return this.purchaseRequestsService.findAllForActor(actor);
  }

  @Post('notifications/read')
  @Roles('admin', 'pengaju')
  @HttpCode(HttpStatus.OK)
  async markNotificationsRead(
    @Body(new ZodValidationPipe(markNotificationsReadSchema)) dto: MarkNotificationsReadDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: { updated: number } }> {
    return { data: await this.purchaseRequestsService.markNotificationsRead(dto, actor) };
  }

  @Post('import')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async importRequests(
    @Body(new ZodValidationPipe(importPurchaseRequestsSchema)) dto: ImportPurchaseRequestsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestImportResult }> {
    return { data: await this.purchaseRequestsService.importByAdmin(dto, actor) };
  }

  @Get(':id')
  @Roles('admin', 'pengaju')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.findOneForActor(id, actor) };
  }

  @Post()
  @Roles('pengaju')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createPurchaseRequestSchema)) dto: CreatePurchaseRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.create(dto, actor) };
  }

  @Patch(':id')
  @Roles('admin')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePurchaseRequestSchema)) dto: UpdatePurchaseRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.updateByAdmin(id, dto, actor) };
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revisionBodySchema)) body: { expectedRevision?: number },
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: { id: string; deleted: true } }> {
    return {
      data: await this.purchaseRequestsService.removeByAdmin(id, body.expectedRevision, actor),
    };
  }

  @Post(':id/cancel')
  @Roles('pengaju')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revisionBodySchema)) body: { expectedRevision?: number },
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return {
      data: await this.purchaseRequestsService.cancelByPengaju(id, body.expectedRevision, actor),
    };
  }

  @Patch(':id/submission-status')
  @Roles('admin')
  async updateSubmissionStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSubmissionStatusSchema)) dto: UpdateSubmissionStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.updateSubmissionStatus(id, dto, actor) };
  }

  @Post(':id/status')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async changeStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(changeRequestStatusSchema)) dto: ChangeRequestStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.changeStatusByAdmin(id, dto, actor) };
  }

  @Put(':id/invoice')
  @Roles('admin')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async saveInvoice(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(saveInvoiceMetadataSchema)) dto: SaveInvoiceMetadataDto,
    @UploadedFile() file: UploadedInvoiceFileInput | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return {
      data: await this.purchaseRequestsService.saveInvoiceByAdmin(id, dto, file, actor),
    };
  }

  @Get(':id/invoice/file')
  @Roles('admin', 'pengaju')
  async downloadInvoiceFile(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.purchaseRequestsService.getInvoiceFileForActor(id, actor);
    const encodedName = encodeURIComponent(file.name);
    response.setHeader('Content-Type', file.mime);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    response.end(file.content);
  }

  @Post(':id/replacements')
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async proposeReplacement(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(proposeReplacementSchema)) dto: ProposeReplacementDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return { data: await this.purchaseRequestsService.proposeReplacementByAdmin(id, dto, actor) };
  }

  @Post(':id/replacements/:proposalId/respond')
  @Roles('pengaju')
  @HttpCode(HttpStatus.OK)
  async respondReplacement(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body(new ZodValidationPipe(respondReplacementSchema)) dto: RespondReplacementDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: PurchaseRequestItem }> {
    return {
      data: await this.purchaseRequestsService.respondReplacementByPengaju(
        id,
        proposalId,
        dto,
        actor,
      ),
    };
  }
}
