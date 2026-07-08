import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { AIService } from '../../ai/ai.service';

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
export class MessengerConversationService {
  private readonly logger = new Logger(MessengerConversationService.name);
  private sessionData: Map<string, { step: string; collected: CollectedData }> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly aiService: AIService,
  ) {}

  getSessionData(psid: string) {
    if (!this.sessionData.has(psid)) {
      this.sessionData.set(psid, { step: 'greeting', collected: {} });
    }
    return this.sessionData.get(psid)!;
  }

  updateSessionData(psid: string, data: Partial<{ step: string; collected: CollectedData }>) {
    const session = this.getSessionData(psid);
    if (data.step) session.step = data.step;
    if (data.collected) session.collected = { ...session.collected, ...data.collected };
    this.sessionData.set(psid, session);
  }

  clearSession(psid: string) {
    this.sessionData.delete(psid);
  }

  getSteps(): string[] {
    return [
      'greeting',
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
      'awaiting_payment_proof',
      'completed',
    ];
  }
}
