import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AIService } from '../../ai/ai.service';
import { CustomersService } from '../customers/customers.service';
import { BillingService } from '../billing/billing.service';
import { SYSTEM_PROMPT, FAQ_PROMPT } from '../../ai/prompts/system-prompts';
import { ConversationState, Language } from '@prisma/client';

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

interface CollectedData {
  fullName?: string;
  contactNumber?: string;
  emailAddress?: string;
  starlinkEmail?: string;
  starlinkAccount?: string;
  billingAmount?: number;
  billingMonth?: string;
  preferredPayment?: string;
  additionalNotes?: string;
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

    if (customer.isAdminTakeover) {
      await this.customersService.addConversation(customer.id, {
        direction: 'inbound',
        messageType: message.quick_reply ? 'quick_reply' : message.attachments ? 'file' : 'text',
        content: message.text || '[attachment]',
        metadata: message.quick_reply ? { payload: message.quick_reply.payload } : undefined,
      });
      this.logger.log(`Message from customer ${psid} queued for admin (takeover active)`);
      return;
    }

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

    const context = await this.customersService.getConversationContext(customer.id);
    const sessionStep = context?.sessionStep || 'greeting';

    if (customer.conversationState === 'COLLECTING_INFO' && sessionStep !== 'greeting') {
      await this.collectBillingInfo(customer, text, context);
      return;
    }

    const conversationHistory = await this.customersService.getConversations(customer.id, 10);
    const recentContext = conversationHistory.reverse().map(c => c.content);

    await this.customersService.updateConversationContext(customer.id, {
      recentMessages: recentContext.slice(-10),
      lastActiveAt: new Date(),
    });

    const intent = await this.aiService.detectIntent(text, recentContext);
    await this.processIntent(customer, text, intent);
  }

  private async handlePostback(event: MessengerEvent) {
    const psid = event.sender.id;
    const customer = await this.customersService.findOrCreate(psid);
    const payload = event.postback!.payload;

    if (customer.isAdminTakeover) {
      await this.customersService.addConversation(customer.id, {
        direction: 'inbound',
        messageType: 'postback',
        content: payload,
      });
      return;
    }

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
      case 'TALK_TO_BOT':
        await this.customersService.releaseTakeover(customer.id);
        await this.sendTextMessage(customer.messengerPsid, 'The AI assistant is back. How can I help you?');
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

  private async collectBillingInfo(customer: any, text: string, context: any) {
    const sessionStep = context?.sessionStep || 'collect_full_name';
    const collected: CollectedData = (context?.collectedData as CollectedData) || {};

    const steps = [
      'collect_full_name',
      'collect_contact',
      'collect_email',
      'collect_starlink_email',
      'collect_starlink_account',
      'collect_billing_amount',
      'collect_billing_month',
      'collect_payment_method',
      'collect_notes',
      'confirm_info',
    ];

    const currentIndex = steps.indexOf(sessionStep);

    switch (sessionStep) {
      case 'collect_full_name':
        collected.fullName = text;
        break;
      case 'collect_contact':
        collected.contactNumber = text;
        break;
      case 'collect_email':
        collected.emailAddress = text;
        break;
      case 'collect_starlink_email':
        collected.starlinkEmail = text;
        break;
      case 'collect_starlink_account':
        collected.starlinkAccount = text;
        break;
      case 'collect_billing_amount':
        const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
        if (!isNaN(amount)) {
          collected.billingAmount = amount;
        } else {
          await this.sendTextMessage(customer.messengerPsid, 'Please enter a valid amount (e.g., 120.50).');
          return;
        }
        break;
      case 'collect_billing_month':
        collected.billingMonth = text;
        break;
      case 'collect_payment_method':
        collected.preferredPayment = text;
        break;
      case 'collect_notes':
        if (text.toLowerCase() === 'skip' || text.toLowerCase() === 'none') {
          collected.additionalNotes = '';
        } else {
          collected.additionalNotes = text;
        }
        break;
    }

    const nextStep = currentIndex + 1 < steps.length ? steps[currentIndex + 1] : 'confirm_info';

    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: nextStep,
      collectedData: collected,
    });

    await this.promptNextStep(customer, nextStep, collected);
  }

  private async promptNextStep(customer: any, step: string, collected: CollectedData) {
    const prompts: Record<string, string> = {
      collect_full_name: 'Please provide your full name.',
      collect_contact: 'Thank you! What is your contact number?',
      collect_email: 'What is your email address?',
      collect_starlink_email: 'What is your Starlink account email?',
      collect_starlink_account: 'What is your Starlink account number? (Type "skip" if you don\'t know)',
      collect_billing_amount: 'What is the billing amount?',
      collect_billing_month: 'Which billing month? (e.g., January 2025)',
      collect_payment_method: 'Which payment method did you use? (KBZPay, WavePay, AYA Pay, CB Pay, Bank Transfer, Cash)',
      collect_notes: 'Any additional notes? (Type "skip" if none)',
      confirm_info: this.buildConfirmationMessage(collected),
    };

    const message = prompts[step] || 'How can I help you?';
    await this.sendTextMessage(customer.messengerPsid, message);

    if (step === 'confirm_info') {
      await this.sendQuickReplies(customer.messengerPsid, [
        { title: 'Confirm', payload: 'CONFIRM_INFO' },
        { title: 'Start Over', payload: 'START_BILLING' },
      ]);
    }
  }

  private buildConfirmationMessage(collected: CollectedData): string {
    return `Please confirm your information:\n\n` +
      `Name: ${collected.fullName || 'N/A'}\n` +
      `Contact: ${collected.contactNumber || 'N/A'}\n` +
      `Email: ${collected.emailAddress || 'N/A'}\n` +
      `Starlink Email: ${collected.starlinkEmail || 'N/A'}\n` +
      `Starlink Account: ${collected.starlinkAccount || 'N/A'}\n` +
      `Amount: $${collected.billingAmount || 'N/A'}\n` +
      `Month: ${collected.billingMonth || 'N/A'}\n` +
      `Payment Method: ${collected.preferredPayment || 'N/A'}\n` +
      `Notes: ${collected.additionalNotes || 'None'}\n\n` +
      `Please confirm to proceed.`;
  }

  private async handleNaturalConversation(customer: any, text: string) {
    const conversations = await this.customersService.getConversations(customer.id, 10);
    const context = conversations.reverse().map(c => `${c.direction === 'inbound' ? 'User' : 'Assistant'}: ${c.content}`);

    const language = customer.preferredLang === 'MY' ? Language.MY : Language.EN;

    const response = await this.aiService.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT },
        ...context.map(c => ({
          role: c.startsWith('User:') ? 'user' as const : 'assistant' as const,
          content: c.substring(c.indexOf(':') + 2),
        })),
        { role: 'user', content: text },
      ],
      text,
      language,
    );

    await this.customersService.addConversation(customer.id, {
      direction: 'outbound',
      messageType: 'text',
      content: response.text,
      processedByAI: true,
    });

    const history = await this.customersService.getConversations(customer.id, 10);
    await this.customersService.updateConversationContext(customer.id, {
      recentMessages: history.reverse().map(c => c.content).slice(-10),
      lastActiveAt: new Date(),
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
    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: 'collect_full_name',
      collectedData: {},
    });
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
    const faqResponse = await this.aiService.chat(
      [
        { role: 'system', content: SYSTEM_PROMPT + '\n\n' + FAQ_PROMPT },
        { role: 'user', content: 'What are the frequently asked questions?' },
      ],
      'FAQ questions',
      customer.preferredLang === 'MY' ? Language.MY : Language.EN,
    );

    await this.sendTextMessage(customer.messengerPsid, faqResponse.text);
  }

  private async escalateToHuman(customer: any) {
    await this.customersService.update(customer.id, { conversationState: 'ESCALATED' });
    await this.sendTextMessage(customer.messengerPsid,
      "I've escalated your request to a human agent. Someone will get back to you shortly. Thank you for your patience!");
  }

  private async confirmAndProceed(customer: any) {
    const context = await this.customersService.getConversationContext(customer.id);
    const collected: CollectedData = (context?.collectedData as CollectedData) || {};

    try {
      await this.billingService.create({
        customerId: customer.id,
        fullName: collected.fullName || customer.fullName || 'Unknown',
        facebookName: customer.facebookName,
        contactNumber: collected.contactNumber || customer.contactNumber,
        emailAddress: collected.emailAddress || customer.emailAddress,
        starlinkEmail: collected.starlinkEmail || customer.starlinkEmail,
        starlinkAccount: collected.starlinkAccount || customer.starlinkAccount,
        billingAmount: collected.billingAmount || 0,
        billingMonth: collected.billingMonth || 'Unknown',
        additionalNotes: collected.additionalNotes,
      });

      await this.customersService.update(customer.id, { conversationState: 'AWAITING_PAYMENT_PROOF' });
      await this.customersService.updateConversationContext(customer.id, {
        sessionStep: 'awaiting_payment_proof',
      });

      await this.sendTextMessage(customer.messengerPsid,
        "Your billing request has been submitted! Please upload your payment proof (screenshot, receipt, or PDF).");
    } catch (error) {
      this.logger.error('Failed to create billing request', error);
      await this.sendTextMessage(customer.messengerPsid,
        "Sorry, there was an error submitting your request. Please try again or contact support.");
    }
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
