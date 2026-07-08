import { Controller, Get, Post, Put, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { KnowledgeBaseService } from './knowledge-base.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, KnowledgeCategory, Language } from '@prisma/client';

@ApiTags('knowledge-base')
@Controller('knowledge-base')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'List knowledge base entries' })
  async findAll(
    @Query('category') category?: KnowledgeCategory,
    @Query('language') language?: Language,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.knowledgeBaseService.findAll({ category, language, isActive, search, page, limit });
  }

  @Get('stats')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Get knowledge base stats' })
  async getStats() {
    return this.knowledgeBaseService.getStats();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search knowledge base for AI context' })
  async searchForAI(
    @Query('q') query: string,
    @Query('language') language?: Language,
    @Query('limit') limit?: number,
  ) {
    return this.knowledgeBaseService.searchForAI(query, language, limit);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Get knowledge base entry' })
  async findById(@Param('id') id: string) {
    return this.knowledgeBaseService.findById(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Create knowledge base entry' })
  async create(@Body() body: {
    title: string;
    content: string;
    category?: KnowledgeCategory;
    keywords?: string[];
    language?: Language;
    priority?: number;
    createdBy?: string;
  }) {
    return this.knowledgeBaseService.create(body);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Update knowledge base entry' })
  async update(@Param('id') id: string, @Body() body: {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    keywords?: string[];
    language?: Language;
    isActive?: boolean;
    priority?: number;
    updatedBy?: string;
  }) {
    return this.knowledgeBaseService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Delete knowledge base entry' })
  async delete(@Param('id') id: string) {
    return this.knowledgeBaseService.delete(id);
  }
}
