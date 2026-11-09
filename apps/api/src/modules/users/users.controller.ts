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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtCookieAuthGuard } from '../../common/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.types';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from './dto/user.dto';
import type { CreateUserDto, ListUsersQueryDto, UpdateUserDto } from './dto/user.dto';
import { UsersService } from './users.service';
import type { UserAccountItem, UserAccountListResponse } from './users.types';

@Controller('users')
@UseGuards(JwtCookieAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listUsersQuerySchema)) query: ListUsersQueryDto,
  ): Promise<UserAccountListResponse> {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<{ data: UserAccountItem }> {
    return { data: await this.usersService.findOne(id) };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserDto,
  ): Promise<{ data: UserAccountItem }> {
    return { data: await this.usersService.create(dto) };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: UserAccountItem }> {
    return { data: await this.usersService.update(id, dto, actor) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ data: { id: string; deleted: true } }> {
    return { data: await this.usersService.remove(id, actor) };
  }
}
