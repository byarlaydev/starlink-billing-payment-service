import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123456', 12);

  await prisma.adminUser.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      fullName: 'System Administrator',
      role: Role.SUPER_ADMIN,
    },
  });

  const defaultSettings = [
    { category: 'ai', key: 'gemini_api_key', value: '', isEncrypted: true, description: 'Google Gemini API Key' },
    { category: 'ai', key: 'gemini_model', value: 'gemini-2.5-flash', isEncrypted: false, description: 'Gemini model to use' },
    { category: 'ai', key: 'temperature', value: '0.3', isEncrypted: false, description: 'AI temperature setting' },
    { category: 'ai', key: 'max_output_tokens', value: '4096', isEncrypted: false, description: 'Max output tokens' },
    { category: 'ai', key: 'system_prompt', value: 'You are a helpful billing assistant.', isEncrypted: false, description: 'Default system prompt' },
    { category: 'facebook', key: 'page_access_token', value: '', isEncrypted: true, description: 'Facebook Page Access Token' },
    { category: 'facebook', key: 'verify_token', value: '', isEncrypted: true, description: 'Facebook Verify Token' },
    { category: 'facebook', key: 'app_secret', value: '', isEncrypted: true, description: 'Facebook App Secret' },
    { category: 'telegram', key: 'bot_token', value: '', isEncrypted: true, description: 'Telegram Bot Token' },
    { category: 'telegram', key: 'admin_chat_id', value: '', isEncrypted: false, description: 'Telegram Admin Chat ID' },
    { category: 'telegram', key: 'enabled', value: 'true', isEncrypted: false, description: 'Enable Telegram notifications' },
    { category: 'storage', key: 'upload_dir', value: './uploads', isEncrypted: false, description: 'Upload directory path' },
    { category: 'storage', key: 'max_file_size', value: '10485760', isEncrypted: false, description: 'Max file size in bytes' },
    { category: 'storage', key: 'allowed_file_types', value: 'image/png,image/jpeg,application/pdf', isEncrypted: false, description: 'Allowed MIME types' },
    { category: 'general', key: 'company_name', value: 'Starlink Billing Assistance', isEncrypted: false, description: 'Company display name' },
    { category: 'general', key: 'support_contact', value: 'support@example.com', isEncrypted: false, description: 'Support email' },
    { category: 'general', key: 'timezone', value: 'Asia/Yangon', isEncrypted: false, description: 'Default timezone' },
    { category: 'general', key: 'language', value: 'en', isEncrypted: false, description: 'Default language' },
  ];

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { category_key: { category: setting.category, key: setting.key } },
      update: {},
      create: setting,
    });
  }

  const defaultPrompts = [
    {
      name: 'system_prompt',
      version: '1.0.0',
      content: 'You are an AI assistant for an independent third-party Starlink billing assistance service.',
      isActive: true,
      description: 'Default system prompt v1',
    },
    {
      name: 'payment_proof_extraction',
      version: '1.0.0',
      content: 'Analyze this payment proof image and extract transaction details.',
      isActive: true,
      description: 'Payment proof extraction prompt v1',
    },
  ];

  for (const prompt of defaultPrompts) {
    await prisma.promptVersion.upsert({
      where: { name_version: { name: prompt.name, version: prompt.version } },
      update: {},
      create: prompt,
    });
  }

  const knowledgeBaseEntries = [
    {
      title: 'What is this service?',
      content: 'We are an independent third-party billing assistance service that helps customers process their Starlink billing payments. We are NOT affiliated with, endorsed by, or operated by Starlink or SpaceX. For official Starlink support, please visit starlink.com.',
      category: 'GENERAL',
      keywords: ['service', 'what', 'who', 'affiliation', 'independent'],
      language: 'EN',
      priority: 10,
    },
    {
      title: 'How to submit a billing payment?',
      content: 'To submit a billing payment:\n1. Provide your full name and contact information\n2. Share your Starlink account email\n3. Enter the billing amount and month\n4. Select your payment method\n5. Upload your payment proof (screenshot or receipt)\n6. Wait for confirmation',
      category: 'BILLING',
      keywords: ['submit', 'payment', 'billing', 'how to', 'process'],
      language: 'EN',
      priority: 10,
    },
    {
      title: 'Accepted payment methods',
      content: 'We accept the following payment methods:\n- KBZPay\n- WavePay\n- AYA Pay\n- CB Pay\n- Bank Transfer\n- Cash\n\nPlease ensure your payment proof clearly shows the transaction details.',
      category: 'PAYMENT',
      keywords: ['payment', 'method', 'kbzpay', 'wavepay', 'aya', 'cb pay', 'bank', 'cash'],
      language: 'EN',
      priority: 9,
    },
    {
      title: 'Processing time',
      content: 'Most billing submissions are processed within 24 hours. You will receive a confirmation once your payment has been verified and recorded. During peak periods, processing may take up to 48 hours.',
      category: 'BILLING',
      keywords: ['processing', 'time', 'how long', 'wait', 'confirmation'],
      language: 'EN',
      priority: 8,
    },
    {
      title: 'Payment proof requirements',
      content: 'Your payment proof must clearly show:\n- Transaction ID or reference number\n- Payment date and time\n- Amount paid\n- Sender and receiver names\n- Payment method used\n\nIf the image is unclear, we may request a new copy.',
      category: 'PAYMENT',
      keywords: ['proof', 'receipt', 'screenshot', 'requirements', 'clear', 'transaction'],
      language: 'EN',
      priority: 8,
    },
    {
      title: 'How to check billing status?',
      content: 'You can check your billing status by:\n1. Sending "Check Status" in the chat\n2. Using the quick reply button\n3. Providing your request ID or Starlink account email\n\nWe will show you the current status of your latest billing request.',
      category: 'BILLING',
      keywords: ['status', 'check', 'track', 'request', 'progress'],
      language: 'EN',
      priority: 7,
    },
    {
      title: 'Changing billing information',
      content: 'If you need to change your billing information after submission, please contact our support team immediately. Changes can only be made before the payment is processed. Once approved, modifications are not possible.',
      category: 'POLICY',
      keywords: ['change', 'modify', 'update', 'edit', 'information', 'correction'],
      language: 'EN',
      priority: 6,
    },
    {
      title: 'Data security and privacy',
      content: 'We take data security seriously. All your personal and payment information is encrypted and stored securely. We comply with data privacy regulations and never share your information with third parties except as required for billing processing.',
      category: 'POLICY',
      keywords: ['security', 'privacy', 'data', 'encryption', 'safe', 'protect'],
      language: 'EN',
      priority: 6,
    },
    {
      title: 'Service availability',
      content: 'Our billing assistance service is available 24/7 through Facebook Messenger. Our AI assistant can help you anytime. For human support, our team is available during business hours (9 AM - 6 PM, Monday to Friday).',
      category: 'GENERAL',
      keywords: ['available', 'hours', 'when', 'support', 'business', 'time'],
      language: 'EN',
      priority: 5,
    },
    {
      title: 'Contacting human support',
      content: 'If you need to speak with a human agent, simply type "Talk to Agent" or select the option from the menu. Our team will respond as soon as possible during business hours. For urgent issues, please mark your message as urgent.',
      category: 'GENERAL',
      keywords: ['human', 'agent', 'support', 'contact', 'talk', 'urgent'],
      language: 'EN',
      priority: 7,
    },
  ];

  const existingCount = await prisma.knowledgeBase.count();
  if (existingCount > 0) {
    console.log('Knowledge Base already has entries, skipping seed');
  } else {
    for (const entry of knowledgeBaseEntries) {
      await prisma.knowledgeBase.create({
        data: {
          ...entry,
          language: entry.language as any,
          category: entry.category as any,
          isActive: true,
          createdBy: 'system',
        },
      });
    }
    console.log(`Seeded ${knowledgeBaseEntries.length} knowledge base entries`);
  }

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
