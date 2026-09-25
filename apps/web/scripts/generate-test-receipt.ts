#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { generateReceipt } from '../src/lib/receipt';

const prisma = new PrismaClient();

async function main() {
  const version = await prisma.version.findFirst({
    where: { versionNumber: 2 },
    orderBy: { createdAt: 'desc' },
  });

  if (!version) {
    console.error('Version 2 not found');
    process.exit(1);
  }

  console.log('Generating receipt for version:', version.id);
  const receiptId = await generateReceipt(version.id);
  console.log('Receipt ID:', receiptId);
  console.log('Receipt URL:', `/r/${receiptId}`);
}

main()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
