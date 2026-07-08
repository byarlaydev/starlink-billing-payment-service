import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

export function generateUniqueFilename(originalName: string): string {
  const ext = path.extname(originalName);
  const uniqueId = uuidv4().replace(/-/g, '');
  const timestamp = Date.now();
  return `${timestamp}_${uniqueId}${ext}`;
}

export function generateRequestId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BL-${timestamp}-${random}`;
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
