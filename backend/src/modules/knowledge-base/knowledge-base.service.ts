import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { KnowledgeCategory, Language } from '@prisma/client';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    title: string;
    content: string;
    category?: KnowledgeCategory;
    keywords?: string[];
    language?: Language;
    priority?: number;
    createdBy?: string;
  }) {
    const entry = await this.prisma.knowledgeBase.create({
      data: {
        title: data.title,
        content: data.content,
        category: data.category || KnowledgeCategory.GENERAL,
        keywords: data.keywords || [],
        language: data.language || Language.EN,
        priority: data.priority || 0,
        createdBy: data.createdBy,
      },
    });

    this.logger.log(`Knowledge base entry created: ${entry.title}`);
    return entry;
  }

  async findAll(filter?: {
    category?: KnowledgeCategory;
    language?: Language;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.language) where.language = filter.language;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;
    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { content: { contains: filter.search, mode: 'insensitive' } },
        { keywords: { has: filter.search } },
      ];
    }

    const page = filter?.page || 1;
    const limit = filter?.limit || 50;

    const [data, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.knowledgeBase.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    const entry = await this.prisma.knowledgeBase.findUnique({ where: { id } });
    if (!entry) throw new NotFoundException('Knowledge base entry not found');
    return entry;
  }

  async update(id: string, data: {
    title?: string;
    content?: string;
    category?: KnowledgeCategory;
    keywords?: string[];
    language?: Language;
    isActive?: boolean;
    priority?: number;
    updatedBy?: string;
  }) {
    const entry = await this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        ...data,
        updatedBy: data.updatedBy,
      },
    });
    return entry;
  }

  async delete(id: string) {
    await this.prisma.knowledgeBase.delete({ where: { id } });
  }

  async getActiveByCategory(category: KnowledgeCategory, language: Language = Language.EN) {
    return this.prisma.knowledgeBase.findMany({
      where: { category, language, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async searchForAI(query: string, language: Language = Language.EN, limit = 5) {
    const queryLower = query.toLowerCase();
    const entries = await this.prisma.knowledgeBase.findMany({
      where: { language, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    const scored = entries.map(entry => {
      let score = 0;
      const titleLower = entry.title.toLowerCase();
      const contentLower = entry.content.toLowerCase();

      if (titleLower.includes(queryLower)) score += 10;
      if (contentLower.includes(queryLower)) score += 5;

      const queryWords = queryLower.split(/\s+/);
      for (const word of queryWords) {
        if (word.length < 3) continue;
        if (titleLower.includes(word)) score += 3;
        if (contentLower.includes(word)) score += 1;
        if (entry.keywords.some(k => k.toLowerCase().includes(word))) score += 4;
      }

      return { ...entry, score };
    });

    return scored
      .filter(e => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getStats() {
    const [total, active, byCategory] = await Promise.all([
      this.prisma.knowledgeBase.count(),
      this.prisma.knowledgeBase.count({ where: { isActive: true } }),
      this.prisma.knowledgeBase.groupBy({
        by: ['category'],
        _count: true,
      }),
    ]);

    return { total, active, byCategory };
  }
}
