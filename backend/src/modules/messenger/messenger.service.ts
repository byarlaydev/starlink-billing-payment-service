import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AIService } from '../../ai/ai.service';
import { CustomersService } from '../customers/customers.service';
import { BillingService } from '../billing/billing.service';
import { MessagingService } from '../../messaging/messaging.service';
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
  starlinkAccountId?: string;
  billingAmount?: number;
  billingMonth?: string;
  preferredPayment?: string;
  additionalNotes?: string;
}

interface CustomerContext {
  customer: any;
  conversationHistory: any[];
  billingHistory: any[];
  conversationContext: any;
  starlinkAccounts: any[];
  lastInteraction: string;
  totalInteractions: number;
}

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AIService,
    private readonly customersService: CustomersService,
    private readonly billingService: BillingService,
    private readonly messagingService: MessagingService,
  ) {}

  private async loadFullCustomerContext(customerId: string, psid: string, channel?: string): Promise<CustomerContext> {
    const customer = await this.customersService.findOrCreate(psid, undefined, channel);
    
    const [conversationHistory, billingHistory, conversationContext, starlinkAccounts] = await Promise.all([
      this.customersService.getConversations(customer.id, 20),
      this.billingService.findByCustomer(customer.id, 1, 10),
      this.customersService.getConversationContext(customer.id),
      this.prisma.starlinkAccount.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    const sortedHistory = conversationHistory.reverse();
    const lastInteraction = sortedHistory.length > 0 
      ? sortedHistory[sortedHistory.length - 1].createdAt.toISOString()
      : customer.createdAt.toISOString();

    return {
      customer,
      conversationHistory: sortedHistory,
      billingHistory: billingHistory.data,
      conversationContext,
      starlinkAccounts,
      lastInteraction,
      totalInteractions: sortedHistory.length,
    };
  }

  private buildCustomerProfile(context: CustomerContext): string {
    const { customer, billingHistory, conversationHistory, starlinkAccounts, totalInteractions } = context;
    
    let profile = `\n\n=== CUSTOMER PROFILE ===\n`;
    profile += `Name: ${customer.fullName || customer.facebookName || 'Not provided'}\n`;
    profile += `Facebook Name: ${customer.facebookName || 'N/A'}\n`;
    profile += `Contact: ${customer.contactNumber || 'N/A'}\n`;
    profile += `Email: ${customer.emailAddress || 'N/A'}\n`;
    profile += `Preferred Language: ${customer.preferredLang}\n`;
    profile += `Total Interactions: ${totalInteractions}\n`;

    if (starlinkAccounts.length > 0) {
      profile += `\n=== STARLINK ACCOUNTS (${starlinkAccounts.length}) ===\n`;
      starlinkAccounts.forEach((account, i) => {
        const primaryTag = account.isPrimary ? ' [PRIMARY]' : '';
        const nickname = account.nickname ? ` (${account.nickname})` : '';
        profile += `${i + 1}. ${account.email}${nickname}${primaryTag}\n`;
        if (account.accountNumber) {
          profile += `   Account #: ${account.accountNumber}\n`;
        }
      });
    } else {
      profile += `\n=== STARLINK ACCOUNTS ===\n`;
      profile += `No Starlink accounts registered yet\n`;
    }
    
    if (billingHistory.length > 0) {
      profile += `\n=== BILLING HISTORY ===\n`;
      billingHistory.slice(0, 3).forEach((req, i) => {
        profile += `${i + 1}. Request ${req.requestId}: $${req.billingAmount} for ${req.billingMonth} - Status: ${req.status}\n`;
      });
    }

    if (conversationHistory.length > 0) {
      profile += `\n=== RECENT CONVERSATION ===\n`;
      const recent = conversationHistory.slice(-5);
      recent.forEach(msg => {
        const sender = msg.direction === 'inbound' ? 'Customer' : 'You';
        profile += `${sender}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}\n`;
      });
    }

    profile += `========================\n`;
    return profile;
  }

  async handleWebhookEvent(event: MessengerEvent) {
    if (event.message) {
      await this.handleMessage(event);
    } else if (event.postback) {
      await this.handlePostback(event);
    }
  }

  async handleInventInbound(psid: string, text: string) {
    const context = await this.loadFullCustomerContext(psid, psid, 'invent');
    const customer = context.customer;

    await this.customersService.addConversation(customer.id, {
      direction: 'inbound',
      messageType: 'text',
      content: text,
    });

    if (customer.isAdminTakeover) {
      this.logger.log(`Invent message from ${psid} queued for admin (takeover active)`);
      return;
    }

    const lowerText = text.toLowerCase().trim();

    if (['confirm_info', 'start_billing', 'check_status', 'faq', 'escalate'].includes(lowerText)) {
      await this.handleQuickReply(customer, lowerText.toUpperCase(), context);
      return;
    }

    const sessionStep = context.conversationContext?.sessionStep || 'greeting';

    if (customer.conversationState === 'COLLECTING_INFO' && sessionStep !== 'greeting') {
      await this.collectBillingInfo(customer, text, context.conversationContext, context);
      return;
    }

    const recentContext = context.conversationHistory.map(c => c.content);

    await this.customersService.updateConversationContext(customer.id, {
      recentMessages: recentContext.slice(-10),
      lastActiveAt: new Date(),
    });

    this.logger.log(`Invent: starting AI processing for ${psid}: "${text.substring(0, 50)}"`);

    try {
      const intent = await this.aiService.detectIntent(text, recentContext);
      this.logger.log(`Invent: intent detected for ${psid}: ${intent.intent}`);
      await this.processIntent(customer, text, intent, context);
    } catch (error) {
      this.logger.error(`Invent: AI processing failed for ${psid}`, error);
      await this.messagingService.sendMessage(psid,
        "Sorry, I'm having a bit of trouble right now. Please try again in a moment, or type 'agent' to talk to someone.");
    }
  }

  private async handleMessage(event: MessengerEvent) {
    const psid = event.sender.id;
    const message = event.message!;
    
    const context = await this.loadFullCustomerContext(psid, psid, 'messenger');
    const customer = context.customer;

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
      await this.handleQuickReply(customer, message.quick_reply.payload, context);
      return;
    }

    const text = message.text || '';
    if (!text) return;

    const sessionStep = context.conversationContext?.sessionStep || 'greeting';

    if (customer.conversationState === 'COLLECTING_INFO' && sessionStep !== 'greeting') {
      await this.collectBillingInfo(customer, text, context.conversationContext, context);
      return;
    }

    const recentContext = context.conversationHistory.map(c => c.content);

    await this.customersService.updateConversationContext(customer.id, {
      recentMessages: recentContext.slice(-10),
      lastActiveAt: new Date(),
    });

    const intent = await this.aiService.detectIntent(text, recentContext);
    await this.processIntent(customer, text, intent, context);
  }

  private async handlePostback(event: MessengerEvent) {
    const psid = event.sender.id;
    const context = await this.loadFullCustomerContext(psid, psid, 'messenger');
    const customer = context.customer;
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

    await this.handleQuickReply(customer, payload, context);
  }

  private async handleQuickReply(customer: any, payload: string, context?: CustomerContext) {
    switch (payload) {
      case 'START_BILLING':
        await this.startBillingFlow(customer, context);
        break;
      case 'CHECK_STATUS':
        await this.checkStatus(customer, context);
        break;
      case 'FAQ':
        await this.sendFAQ(customer, context);
        break;
      case 'ESCALATE':
        await this.escalateToHuman(customer, context);
        break;
      case 'CONFIRM_INFO':
        await this.confirmAndProceed(customer);
        break;
      case 'TALK_TO_BOT':
        await this.customersService.releaseTakeover(customer.id);
        await this.messagingService.sendMessage(customer.messengerPsid, 'No problem! I\'m back. What can I help you with?');
        break;
      default:
        await this.messagingService.sendMessage(customer.messengerPsid, "Hmm, I'm not quite sure what you mean there. Could you try rephrasing that, or just let me know what you need help with?");
    }
  }

  private async processIntent(customer: any, text: string, intent: any, context: CustomerContext) {
    switch (intent.intent) {
      case 'greeting':
        await this.sendWelcomeMessage(customer, context);
        break;
      case 'billing_inquiry':
      case 'submit_payment':
        await this.startBillingFlow(customer, context);
        break;
      case 'check_status':
        await this.checkStatus(customer, context);
        break;
      case 'faq':
        await this.sendFAQ(customer, context);
        break;
      case 'escalation':
      case 'complaint':
        await this.escalateToHuman(customer, context);
        break;
      default:
        await this.handleNaturalConversation(customer, text, context);
    }
  }

  private async collectBillingInfo(customer: any, text: string, context: any, fullContext: CustomerContext) {
    const sessionStep = context?.sessionStep || 'collect_full_name';
    const collected: CollectedData = (context?.collectedData as CollectedData) || {};

    // Handle account selection step
    if (sessionStep === 'select_starlink_account') {
      await this.processStarlinkAccountSelection(customer, text, fullContext);
      return;
    }

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
          await this.messagingService.sendMessage(customer.messengerPsid, 'No worries, just need the number. Could you try again? Something like 120.50 would work.');
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

    // Check if we need to handle Starlink account selection
    if (sessionStep === 'collect_email' && !collected.starlinkAccountId) {
      // After collecting email, check for existing Starlink accounts
      await this.customersService.updateConversationContext(customer.id, {
        sessionStep: nextStep,
        collectedData: collected,
      });
      
      // Refresh context to get latest accounts
      const updatedContext = await this.loadFullCustomerContext(customer.id, customer.messengerPsid);
      await this.handleStarlinkAccountSelection(customer, updatedContext);
      return;
    }

    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: nextStep,
      collectedData: collected,
    });

    await this.promptNextStep(customer, nextStep, collected, fullContext);
  }

  private async promptNextStep(customer: any, step: string, collected: CollectedData, context: CustomerContext) {
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';
    const nameGreeting = firstName ? `${firstName}, ` : '';
    
    const prompts: Record<string, string> = {
      collect_full_name: `Sure thing! Can I get your full name to start with?`,
      collect_contact: `Got it${firstName ? `, ${firstName}` : ''}! What's the best number to reach you at?`,
      collect_email: `Perfect. And your email address?`,
      collect_starlink_email: `Great, thanks! Now, what email did you use for your Starlink account?`,
      collect_starlink_account: `Do you happen to have your Starlink account number handy? If not, just type "skip" and we can work without it.`,
      collect_billing_amount: `Alright, what's the billing amount you're looking to pay?`,
      collect_billing_month: `Which month is this for? (like "January 2025")`,
      collect_payment_method: `And how did you make the payment? You can choose from KBZPay, WavePay, AYA Pay, CB Pay, Bank Transfer, or Cash.`,
      collect_notes: `Last thing - anything else I should know about this payment? If not, just type "skip".`,
      confirm_info: this.buildConfirmationMessage(collected, firstName),
    };

    const message = prompts[step] || 'How can I help you?';
    await this.messagingService.sendMessage(customer.messengerPsid, message);

    if (step === 'confirm_info') {
      await this.messagingService.sendQuickReplies(customer.messengerPsid, 'Please select an option:', [
        { title: 'Looks Good', payload: 'CONFIRM_INFO' },
        { title: 'Start Over', payload: 'START_BILLING' },
      ]);
    }
  }

  private buildConfirmationMessage(collected: CollectedData, firstName: string): string {
    return `${firstName ? `Alright ${firstName}, ` : 'Alright, '}here's what I've got:\n\n` +
      `👤 Name: ${collected.fullName || 'N/A'}\n` +
      `📱 Contact: ${collected.contactNumber || 'N/A'}\n` +
      `📧 Email: ${collected.emailAddress || 'N/A'}\n` +
      `🛰️ Starlink Email: ${collected.starlinkEmail || 'N/A'}\n` +
      `🔢 Starlink Account: ${collected.starlinkAccount || 'N/A'}\n` +
      `💰 Amount: $${collected.billingAmount || 'N/A'}\n` +
      `📅 Month: ${collected.billingMonth || 'N/A'}\n` +
      `💳 Payment Method: ${collected.preferredPayment || 'N/A'}\n` +
      `📝 Notes: ${collected.additionalNotes || 'None'}\n\n` +
      `Does everything look right?`;
  }

  private async handleNaturalConversation(customer: any, text: string, context: CustomerContext) {
    const conversationHistory = context.conversationHistory;
    const conversationContext = conversationHistory.map(c => 
      `${c.direction === 'inbound' ? 'Customer' : 'You'}: ${c.content}`
    );

    const customerProfile = this.buildCustomerProfile(context);
    const language = customer.preferredLang === 'MY' ? Language.MY : Language.EN;

    const basePrompt = await this.aiService.getEffectiveSystemPrompt();
    const systemPrompt = basePrompt + customerProfile;

    const response = await this.aiService.chat(
      [
        { role: 'system', content: systemPrompt },
        ...conversationContext.map(c => ({
          role: c.startsWith('Customer:') ? 'user' as const : 'assistant' as const,
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

    await this.messagingService.sendMessage(customer.messengerPsid, response.text);
  }

  private async handleAttachment(customer: any, message: any) {
    const attachment = message.attachments[0];
    if (attachment.type === 'image' || attachment.type === 'file') {
      const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';
      await this.messagingService.sendMessage(customer.messengerPsid,
        `Thanks${firstName ? `, ${firstName}` : ''}! I've got your payment proof. I'll take a look at it right away and get back to you with a confirmation shortly. 👍`);

      await this.customersService.update(customer.id, { conversationState: 'PROCESSING_PAYMENT' });
    }
  }

  private async sendWelcomeMessage(customer: any, context: CustomerContext) {
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';
    const hasHistory = context.totalInteractions > 0;
    const hasBillingHistory = context.billingHistory.length > 0;

    let greeting = '';
    
    if (hasHistory && firstName) {
      greeting = `Hey ${firstName}! Good to hear from you again. `;
      if (hasBillingHistory) {
        const lastRequest = context.billingHistory[0];
        greeting += `I see your last request (${lastRequest.requestId}) is ${lastRequest.status.toLowerCase()}. `;
      }
    } else if (firstName) {
      greeting = `Hi ${firstName}! `;
    } else {
      greeting = `Hey there! `;
    }

    const message = `${greeting}Welcome to our Starlink Billing Assistance Service.
    
Just so you know, we're an independent third-party service - not affiliated with Starlink or SpaceX directly. We're here to help make your billing process smoother.
    
What can I help you with today?`;

    this.logger.log(`Invent: sending welcome message to ${customer.messengerPsid}`);
    await this.messagingService.sendMessage(customer.messengerPsid, message);
    await this.messagingService.sendQuickReplies(customer.messengerPsid, 'Please select an option:', [
      { title: 'Submit Payment', payload: 'START_BILLING' },
      { title: 'Check Status', payload: 'CHECK_STATUS' },
      { title: 'FAQ', payload: 'FAQ' },
      { title: 'Talk to Agent', payload: 'ESCALATE' },
    ]);
    this.logger.log(`Invent: welcome message sent to ${customer.messengerPsid}`);
  }

  private async startBillingFlow(customer: any, context?: CustomerContext) {
    await this.customersService.update(customer.id, { conversationState: 'COLLECTING_INFO' });
    
    const prefillData: CollectedData = {};
    if (customer.fullName) prefillData.fullName = customer.fullName;
    if (customer.contactNumber) prefillData.contactNumber = customer.contactNumber;
    if (customer.emailAddress) prefillData.emailAddress = customer.emailAddress;
    if (customer.starlinkEmail) prefillData.starlinkEmail = customer.starlinkEmail;
    if (customer.starlinkAccount) prefillData.starlinkAccount = customer.starlinkAccount;

    const hasPrefilled = Object.keys(prefillData).length > 0;
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';

    let message = '';
    let nextStep = 'collect_full_name';

    if (hasPrefilled) {
      message = `${firstName ? `Alright ${firstName}, ` : ''}let's get this billing submission started. I've got some of your info already, so this should be quick!`;
      
      if (prefillData.fullName) {
        nextStep = 'collect_contact';
        message += `\n\nI already have your name as ${prefillData.fullName}. What's the best number to reach you at?`;
      }
    } else {
      message = `Sure thing! Let's get your billing submission started. Can I get your full name to begin with?`;
    }

    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: nextStep,
      collectedData: prefillData,
    });

    await this.messagingService.sendMessage(customer.messengerPsid, message);
  }

  private async handleStarlinkAccountSelection(customer: any, context: CustomerContext) {
    const accounts = context.starlinkAccounts || [];
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';

    if (accounts.length === 0) {
      // No accounts, proceed to collect new account
      const contextData = await this.customersService.getConversationContext(customer.id);
      const collected: CollectedData = (contextData?.collectedData as any) || {};
      await this.customersService.updateConversationContext(customer.id, {
        sessionStep: 'collect_starlink_email',
        collectedData: collected,
      });
      await this.messagingService.sendMessage(customer.messengerPsid, 
        `${firstName ? `No worries, ${firstName}!` : 'No worries!'} What email did you use for your Starlink account?`);
      return;
    }

    if (accounts.length === 1) {
      // Only one account, use it automatically
      const account = accounts[0];
      const contextData = await this.customersService.getConversationContext(customer.id);
      const collected: CollectedData = (contextData?.collectedData as any) || {};
      collected.starlinkEmail = account.email;
      collected.starlinkAccount = account.accountNumber;
      collected.starlinkAccountId = account.id;
      
      await this.customersService.updateConversationContext(customer.id, {
        sessionStep: 'collect_billing_amount',
        collectedData: collected,
      });
      
      await this.messagingService.sendMessage(customer.messengerPsid,
        `${firstName ? `Great, ${firstName}!` : 'Great!'} I found your Starlink account (${account.email}). What's the billing amount you're looking to pay?`);
      return;
    }

    // Multiple accounts - ask which one to use
    let accountList = `${firstName ? `${firstName}, ` : ''}I see you have multiple Starlink accounts. Which one would you like to use for this billing?\n\n`;
    accounts.forEach((account, index) => {
      const primaryTag = account.isPrimary ? ' ⭐' : '';
      const nickname = account.nickname ? ` (${account.nickname})` : '';
      accountList += `${index + 1}. ${account.email}${nickname}${primaryTag}\n`;
      if (account.accountNumber) {
        accountList += `   Account #: ${account.accountNumber}\n`;
      }
    });
    accountList += `\nJust reply with the number (1-${accounts.length}) of the account you want to use.`;

    const contextData = await this.customersService.getConversationContext(customer.id);
    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: 'select_starlink_account',
      collectedData: (contextData?.collectedData as any) || {},
    });

    await this.messagingService.sendMessage(customer.messengerPsid, accountList);
  }

  private async processStarlinkAccountSelection(customer: any, text: string, context: CustomerContext) {
    const accounts = context.starlinkAccounts || [];
    const selection = parseInt(text.trim());
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';

    if (isNaN(selection) || selection < 1 || selection > accounts.length) {
      await this.messagingService.sendMessage(customer.messengerPsid,
        `Hmm, that's not quite right. Please reply with a number between 1 and ${accounts.length}.`);
      return;
    }

    const selectedAccount = accounts[selection - 1];
    const contextData = await this.customersService.getConversationContext(customer.id);
    const collected: CollectedData = (contextData?.collectedData as any) || {};
    collected.starlinkEmail = selectedAccount.email;
    collected.starlinkAccount = selectedAccount.accountNumber;
    collected.starlinkAccountId = selectedAccount.id;

    await this.customersService.updateConversationContext(customer.id, {
      sessionStep: 'collect_billing_amount',
      collectedData: collected,
    });

    const accountDisplay = selectedAccount.nickname 
      ? `${selectedAccount.email} (${selectedAccount.nickname})`
      : selectedAccount.email;

    await this.messagingService.sendMessage(customer.messengerPsid,
      `${firstName ? `Perfect, ${firstName}!` : 'Perfect!'} Using ${accountDisplay}. What's the billing amount you're looking to pay?`);
  }

  private async checkStatus(customer: any, context?: CustomerContext) {
    const billingHistory = context?.billingHistory || [];
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';

    if (billingHistory.length === 0) {
      await this.messagingService.sendMessage(customer.messengerPsid, 
        `${firstName ? `Hey ${firstName}, ` : ''}looks like you don't have any billing requests yet. Want to submit one now?`);
      return;
    }

    const latest = billingHistory[0];
    const statusEmoji = latest.status === 'APPROVED' ? '✅' : 
                       latest.status === 'REJECTED' ? '❌' : 
                       latest.status === 'PROCESSING' ? '⏳' : '📋';

    await this.messagingService.sendMessage(customer.messengerPsid,
      `${firstName ? `${firstName}, ` : ''}here's your latest billing request:\n\n` +
      `${statusEmoji} Request ID: ${latest.requestId}\n` +
      `💰 Amount: $${latest.billingAmount}\n` +
      `📅 Month: ${latest.billingMonth}\n` +
      `📊 Status: ${latest.status}\n\n` +
      `Need help with anything else?`);
  }

  private async sendFAQ(customer: any, context?: CustomerContext) {
    const customerProfile = context ? this.buildCustomerProfile(context) : '';
    const language = customer.preferredLang === 'MY' ? Language.MY : Language.EN;

    const basePrompt = await this.aiService.getEffectiveSystemPrompt();
    const faqResponse = await this.aiService.chat(
      [
        { role: 'system', content: basePrompt + customerProfile },
        { role: 'user', content: 'What are the most common questions people ask? Give me a friendly overview.' },
      ],
      'FAQ questions',
      language,
    );

    await this.messagingService.sendMessage(customer.messengerPsid, faqResponse.text);
  }

  private async escalateToHuman(customer: any, context?: CustomerContext) {
    await this.customersService.update(customer.id, { conversationState: 'ESCALATED' });
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';
    
    await this.messagingService.sendMessage(customer.messengerPsid,
      `${firstName ? `No problem, ${firstName}.` : 'No problem.'} I'll get one of our team members to help you out. They'll be with you shortly. Thanks for your patience! 🙏`);
  }

  private async confirmAndProceed(customer: any) {
    const context = await this.customersService.getConversationContext(customer.id);
    const collected: CollectedData = (context?.collectedData as CollectedData) || {};
    const firstName = customer.fullName?.split(' ')[0] || customer.facebookName?.split(' ')[0] || '';

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

      await this.messagingService.sendMessage(customer.messengerPsid,
        `${firstName ? `Awesome, ${firstName}!` : 'Awesome!'} Your billing request is all set. Now just upload your payment proof - that can be a screenshot, receipt, or PDF. I'll take it from there.`);
    } catch (error) {
      this.logger.error('Failed to create billing request', error);
      await this.messagingService.sendMessage(customer.messengerPsid,
        `Hmm, something went wrong while submitting your request. Let's try again, or if you prefer, I can get a human to help you out.`);
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
