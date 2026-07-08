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
