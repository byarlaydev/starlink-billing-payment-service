import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AIService } from '../../ai/ai.service';
import { CustomersService } from '../customers/customers.service';
import { BillingService } from '../billing/billing.service';
import { SYSTEM_PROMPT, FAQ_PROMPT } from '../../ai/prompts/system-prompts';
import { ConversationState } from '@prisma/client';

interface MessengerEvent {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    attachments?: any[];
    quick_reply?: { payload: string };
  };
  postback?: { payload: string; title: string };
}

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private readonly pageAccessToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly customersService: CustomersService,
    private readonly billingService: BillingService,
  ) {
    this.pageAccessToken = this.configService.get<string>('FB_PAGE_ACCESS_TOKEN', '');
  }

  async handleWebhookEvent(event: MessengerEvent) {
    if (event.message) {
      await this.handleMessage(event);
    } else if (event.postback) {
      await this.handlePostback(event);
    }
  }

  private async handleMessage(event: MessengerEvent) {
    const psid = event.sender.id;
    const message = event.message!;

    const customer = await this.customersService.findOrCreate(psid);

    await this.customersService.addConversation(customer.id, {
      direction: 'inbound',
      messageType: message.quick_reply ? 'quick_reply' : message.attachments ? 'file' : 'text',
      content: message.text || '[attachment]',
      metadata: message.quick_reply ? { payload: message.quick_reply.payload } : undefined,
    });

    if (message.attachments) {
      await this.handleAttachment(customer, message);
      return;
    }

    if (message.quick_reply) {
      await this.handleQuickReply(customer, message.quick_reply.payload);
      return;
    }

    const text = message.text || '';
    if (!text) return;

    const intent = await this.aiService.detectIntent(text);
    await this.processIntent(customer, text, intent);
  }

  private async handlePostback(event: MessengerEvent) {
    const psid = event.sender.id;
    const customer = await this.customersService.findOrCreate(psid);
    const payload = event.postback!.payload;

    await this.customersService.addConversation(customer.id, {
      direction: 'inbound',
      messageType: 'postback',
      content: payload,
    });

    await this.handleQuickReply(customer, payload);
  }

  private async handleQuickReply(customer: any, payload: string) {
    switch (payload) {
      case 'START_BILLING':
        await this.startBillingFlow(customer);
        break;
      case 'CHECK_STATUS':
        await this.checkStatus(customer);
        break;
      case 'FAQ':
        await this.sendFAQ(customer);
        break;
      case 'ESCALATE':
        await this.escalateToHuman(customer);
        break;
      case 'CONFIRM_INFO':
        await this.confirmAndProceed(customer);
        break;
      default:
        await this.sendTextMessage(customer.messengerPsid, "I'm not sure what you mean. Please try again or type HELP for options.");
    }
  }

  private async processIntent(customer: any, text: string, intent: any) {
    switch (intent.intent) {
      case 'greeting':
        await this.sendWelcomeMessage(customer);
        break;
      case 'billing_inquiry':
      case 'submit_payment':
        await this.startBillingFlow(customer);
        break;
      case 'check_status':
        await this.checkStatus(customer);
        break;
      case 'faq':
        await this.sendFAQ(customer);
        break;
      case 'escalation':
      case 'complaint':
        await this.escalateToHuman(customer);
        break;
      default:
        await this.handleNaturalConversation(customer, text);
    }
  }

  private async handleNaturalConversation(customer: any, text: string) {
    const conversations = await this.customersService.getConversations(customer.id, 10);
    const context = conversations.reverse().map(c => `${c.direction === 'inbound' ? 'User' : 'Assistant'}: ${c.content}`);

    const response = await this.aiService.chat([
      { role: 'system', content: SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT },
      ...context.map(c => ({
        role: c.startsWith('User:') ? 'user' as const : 'assistant' as const,
        content: c.substring(c.indexOf(':') + 2),
      })),
      { role: 'user', content: text },
    ]);

    await this.customersService.addConversation(customer.id, {
      direction: 'outbound',
      messageType: 'text',
      content: response.text,
      processedByAI: true,
    });

    await this.sendTextMessage(customer.messengerPsid, response.text);
  }

  private async handleAttachment(customer: any, message: any) {
    const attachment = message.attachments[0];
    if (attachment.type === 'image' || attachment.type === 'file') {
      await this.sendTextMessage(customer.messengerPsid,
        'Thank you for uploading your payment proof! We are processing it now. You will receive a confirmation shortly.');

      await this.customersService.update(customer.id, { conversationState: 'PROCESSING_PAYMENT' });
    }
  }

  private async sendWelcomeMessage(customer: any) {
    const message = `Hello${customer.facebookName ? ` ${customer.facebookName}` : ''}! 👋

Welcome to our Starlink Billing Assistance Service.

*Please note: We are an independent third-party billing assistance service and are NOT affiliated with Starlink or SpaceX.*

How can I help you today?`;

    await this.sendTextMessage(customer.messengerPsid, message);
    await this.sendQuickReplies(customer.messengerPsid, [
      { title: 'Submit Payment', payload: 'START_BILLING' },
      { title: 'Check Status', payload: 'CHECK_STATUS' },
      { title: 'FAQ', payload: 'FAQ' },
      { title: 'Talk to Agent', payload: 'ESCALATE' },
    ]);
  }

  private async startBillingFlow(customer: any) {
    await this.customersService.update(customer.id, { conversationState: 'COLLECTING_INFO' });
    await this.sendTextMessage(customer.messengerPsid,
      "Great! Let's start your billing submission.\n\nPlease provide your full name to begin.");
  }

  private async checkStatus(customer: any) {
    const requests = await this.billingService.findByCustomer(customer.id);
    if (requests.data.length === 0) {
      await this.sendTextMessage(customer.messengerPsid, "You don't have any billing requests yet. Would you like to submit one?");
      return;
    }
    const latest = requests.data[0];
    await this.sendTextMessage(customer.messengerPsid,
      `Your latest billing request (${latest.requestId}):\nStatus: ${latest.status}\nAmount: $${latest.billingAmount}\nMonth: ${latest.billingMonth}`);
  }

  private async sendFAQ(customer: any) {
    await this.sendTextMessage(customer.messengerPsid,
      `Here are some frequently asked questions:\n\n${FAQ_PROMPT.replace(/Q: /g, '\n❓ ').replace(/A: /g, '\n💡 ')}`);
  }

  private async escalateToHuman(customer: any) {
    await this.customersService.update(customer.id, { conversationState: 'ESCALATED' });
    await this.sendTextMessage(customer.messengerPsid,
      "I've escalated your request to a human agent. Someone will get back to you shortly. Thank you for your patience!");
  }

  private async confirmAndProceed(customer: any) {
    await this.sendTextMessage(customer.messengerPsid,
      "Thank you for confirming! Please upload your payment proof (screenshot, receipt, or PDF).");
    await this.customersService.update(customer.id, { conversationState: 'AWAITING_PAYMENT_PROOF' });
  }

  async sendTextMessage(recipientId: string, text: string) {
    try {
      const response = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text },
        }),
      });

      if (!response.ok) {
        this.logger.error(`Failed to send message: ${await response.text()}`);
      }
    } catch (error) {
      this.logger.error('Error sending Messenger message', error);
    }
  }

  private async sendQuickReplies(recipientId: string, replies: { title: string; payload: string }[]) {
    try {
      await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${this.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: {
            text: 'Please select an option:',
            quick_replies: replies.map(r => ({
              content_type: 'text',
              title: r.title,
              payload: r.payload,
            })),
          },
        }),
      });
    } catch (error) {
      this.logger.error('Error sending quick replies', error);
    }
  }

  async verifyWebhook(mode: string, token: string, challenge: string): Promise<string | null> {
    const verifyToken = this.configService.get<string>('FB_VERIFY_TOKEN', '');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified');
      return challenge;
    }
    return null;
  }
}
