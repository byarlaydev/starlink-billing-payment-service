import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { encrypt, decrypt, maskSensitive } from '../../common/utils/encryption.util';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache: Map<string, string> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async get(category: string, key: string): Promise<string | null> {
    const cacheKey = `${category}:${key}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey)!;

    const setting = await this.prisma.setting.findUnique({
      where: { category_key: { category, key } },
    });
    if (!setting) return null;

    const value = setting.isEncrypted ? decrypt(setting.value) : setting.value;
    this.cache.set(cacheKey, value);
    return value;
  }

  async getDecrypted(category: string, key: string): Promise<string | null> {
    const setting = await this.prisma.setting.findUnique({
      where: { category_key: { category, key } },
    });
    if (!setting) return null;
    return setting.isEncrypted ? decrypt(setting.value) : setting.value;
  }

  async set(category: string, key: string, value: string, options?: { isEncrypted?: boolean; description?: string; updatedBy?: string }) {
    const storedValue = options?.isEncrypted ? encrypt(value) : value;

    const setting = await this.prisma.setting.upsert({
      where: { category_key: { category, key } },
      update: {
        value: storedValue,
        isEncrypted: options?.isEncrypted ?? false,
        description: options?.description,
        updatedBy: options?.updatedBy,
        updatedAt: new Date(),
      },
      create: {
        category,
        key,
        value: storedValue,
        isEncrypted: options?.isEncrypted ?? false,
        description: options?.description,
        updatedBy: options?.updatedBy,
      },
    });

    this.cache.delete(`${category}:${key}`);
    return setting;
  }

  async getByCategory(category: string) {
    const settings = await this.prisma.setting.findMany({
      where: { category },
      orderBy: { key: 'asc' },
    });

    return settings.map(s => ({
      ...s,
      value: s.isPublic ? (s.isEncrypted ? maskSensitive(decrypt(s.value)) : s.value) : (s.isEncrypted ? '••••••••' : s.value),
    }));
  }

  async getAll() {
    const categories = ['ai', 'facebook', 'telegram', 'messenger', 'storage', 'general'];
    const result: Record<string, any[]> = {};

    for (const category of categories) {
      result[category] = await this.getByCategory(category);
    }

    return result;
  }

  async updateBatch(category: string, updates: Record<string, string>, updatedBy?: string) {
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
      const isMasked = /^[•*\u2022]+$/.test(value);
      if (isMasked) continue;

      const sensitiveKeys = ['api_key', 'token', 'secret', 'password'];
      const isEncrypted = sensitiveKeys.some(s => key.toLowerCase().includes(s));
      const result = await this.set(category, key, value, { isEncrypted, updatedBy });
      results.push(result);
    }
    return results;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
