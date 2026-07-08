import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { SettingsService } from '../settings/settings.service';
import * as https from 'https';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string;
  private adminChatId: string;
  private isEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.adminChatId = this.configService.get<string>('TELEGRAM_ADMIN_CHAT_ID', '');
    this.isEnabled = this.configService.get<string>('TELEGRAM_ENABLED', 'true') === 'true';
  }

  async notifyNewBillingRequest(billingRequest: any, paymentProof?: any, ocrResult?: any) {
    if (!this.isEnabled) return;

    const message = this.formatBillingNotification(billingRequest, paymentProof, ocrResult);
    const keyboard = this.getActionKeyboard(billingRequest.id);

    try {
      const result = await this.sendPhotoWithCaption(
        this.adminChatId,
        message,
        keyboard,
        paymentProof?.filePath,
      );

      await this.prisma.telegramNotification.create({
        data: {
          billingRequestId: billingRequest.id,
          chatId: this.adminChatId,
          messageType: 'new_request',
          messagePayload: { text: message, keyboard },
          telegramMessageId: result?.result?.message_id,
          status: result?.ok ? 'SENT' : 'FAILED',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Failed to send Telegram notification', error);
      await this.prisma.telegramNotification.create({
        data: {
          billingRequestId: billingRequest.id,
          chatId: this.adminChatId,
          messageType: 'new_request',
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  async notifyStatusChange(billingRequest: any, newStatus: string) {
    if (!this.isEnabled) return;

    const message = `📋 *Status Update*\n\nRequest: \`${billingRequest.requestId}\`\nCustomer: ${billingRequest.fullName}\nNew Status: *${newStatus}*`;

    await this.sendMessage(this.adminChatId, message);
  }

  async notifyManualReview(billingRequest: any, ocrResult: any) {
    if (!this.isEnabled) return;

    const message = `⚠️ *Manual Review Required*\n\nRequest: \`${billingRequest.requestId}\`\nCustomer: ${billingRequest.fullName}\nOCR Confidence: ${ocrResult.confidenceScore}\n\nPlease review this submission manually.`;

    await this.sendMessage(this.adminChatId, message);
  }

  private formatBillingNotification(request: any, proof?: any, ocr?: any): string {
    const lines = [
      '🆕 *New Billing Submission*',
      '',
      `👤 Customer: *${request.fullName}*`,
      request.facebookName ? `📘 FB Name: ${request.facebookName}` : '',
      request.contactNumber ? `📞 Contact: ${request.contactNumber}` : '',
      request.emailAddress ? `📧 Email: ${request.emailAddress}` : '',
      '',
      `💰 Amount: *$${request.billingAmount}*`,
      `📅 Billing Month: ${request.billingMonth}`,
      request.starlinkEmail ? `🛰️ Starlink Email: ${request.starlinkEmail}` : '',
      request.starlinkAccount ? `🔢 Account: ${request.starlinkAccount}` : '',
      '',
    ];

    if (ocr) {
      lines.push(
        '📄 *Payment Proof Analysis*',
        `Transaction ID: ${ocr.transactionId || 'N/A'}`,
        `Payment Date: ${ocr.paymentDate || 'N/A'}`,
        `Amount Paid: ${ocr.amountPaid || 'N/A'}`,
        `Confidence: ${Math.round(ocr.confidenceScore * 100)}%`,
        '',
      );
    }

    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    lines.push(`🔗 [View in Dashboard](${dashboardUrl}/dashboard/requests/${request.id})`);

    return lines.filter(l => l !== '').join('\n');
  }

  private getActionKeyboard(requestId: string) {
    const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    return {
      inline_keyboard: [
        [
          { text: '✅ Approve', callback_data: `approve_${requestId}` },
          { text: '❌ Reject', callback_data: `reject_${requestId}` },
        ],
        [
          { text: 'ℹ️ Request Info', callback_data: `request_info_${requestId}` },
          { text: '🖥️ Dashboard', url: `${dashboardUrl}/dashboard/requests/${requestId}` },
        ],
      ],
    };
  }

  private async sendMessage(chatId: string, text: string, replyMarkup?: any) {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const data = JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      reply_markup: replyMarkup,
    });

    return this.httpsPost(url, data);
  }

  private async sendPhotoWithCaption(chatId: string, caption: string, replyMarkup: any, photoPath?: string) {
    if (photoPath) {
      const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
      const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);
      const fs = await import('fs');
      const path = await import('path');

      const fileBuffer = fs.readFileSync(photoPath);
      const fileName = path.basename(photoPath);

      const parts: Buffer[] = [];

      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="reply_markup"\r\n\r\n${JSON.stringify(replyMarkup)}\r\n`
      ));
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${fileName}"\r\nContent-Type: application/octet-stream\r\n\r\n`
      ));
      parts.push(fileBuffer);
      parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

      const body = Buffer.concat(parts);

      return new Promise<any>((resolve, reject) => {
        const urlObj = new URL(`https://api.telegram.org/bot${this.botToken}/sendPhoto`);
        const options = {
          hostname: urlObj.hostname,
          path: urlObj.pathname,
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });
    }

    return this.sendMessage(chatId, caption, replyMarkup);
  }

  private httpsPost(url: string, data: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(responseData)); } catch { resolve(responseData); }
        });
      });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }
}
