import PDFDocument from 'pdfkit';
import { getReceipt, type ReceiptPayload } from './receipt';
import { sign } from '@human-stamp/core';
import { getSigningKeys } from './keys';

export interface ExportData {
  pdf: Buffer;
  json: {
    data: ReceiptPayload;
    signature: string;
    publicKey: string;
    keyId: string;
  };
}

export async function exportReceipt(receiptId: string): Promise<ExportData> {
  const receipt = await getReceipt(receiptId);
  
  if (!receipt) {
    throw new Error('Receipt not found');
  }

  const payload: ReceiptPayload = JSON.parse(receipt.receiptData);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk) => chunks.push(chunk));

  // Use Times-Roman (standard PDF font, no external files needed)
  doc.fontSize(24).text('Human Stamp', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(18).text('Record of Approval and Disclosure', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(10).text(`Receipt ID: ${receiptId}`, { align: 'center' });
  doc.moveDown(1.5);

  doc.fontSize(12).text('PROJECT', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`Client: ${payload.project.client.name}`);
  doc.text(`Project: ${payload.project.name}`);
  doc.moveDown(1);

  doc.fontSize(12).text('VERSION', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11).text(`Version: v${payload.versionNumber}`);
  doc.text(`Filename: ${payload.filename}`);
  doc.text(`AI Claim: ${payload.aiClaim}`);
  doc.text(`C2PA Present: ${payload.c2paPresent ? 'Yes' : 'No'}`);
  doc.moveDown(1);

  if (payload.approvals.length > 0) {
    doc.fontSize(12).text('INTERNAL APPROVALS', { underline: true });
    doc.moveDown(0.3);
    for (const approval of payload.approvals) {
      doc.fontSize(10).text(
        `• ${approval.approverName ? `${approval.approverName}, ` : ''}${approval.approverRole} at ${approval.company}`,
      );
      doc.fontSize(9).text(`  ${new Date(approval.createdAt).toLocaleString()}`, { indent: 10 });
    }
    doc.moveDown(1);
  }

  if (payload.clientSignOffs.length > 0) {
    doc.fontSize(12).text('CLIENT SIGN-OFFS', { underline: true });
    doc.moveDown(0.3);
    for (const signoff of payload.clientSignOffs) {
      doc.fontSize(10).text(
        `• ${signoff.signerName} (${signoff.email}) — ${signoff.decision}`,
      );
      doc.fontSize(9).text(`  ${new Date(signoff.createdAt).toLocaleString()}`, { indent: 10 });
    }
    doc.moveDown(1);
  }

  doc.fontSize(12).text('FILE HASH', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(8).text(payload.sha256);
  doc.moveDown(1);

  if (payload.eventChainHead) {
    doc.fontSize(12).text('EVENT CHAIN HEAD', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(8).text(payload.eventChainHead);
    doc.moveDown(1);
  }

  doc.fontSize(12).text('CREATED', { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(10).text(new Date(payload.createdAt).toLocaleString());
  doc.moveDown(2);

  doc.fontSize(8).fillColor('#666').text(
    'Legal Disclaimer: This record documents approvals and disclosures. It is not legal advice or a certification of compliance. ' +
    'The signature verifies the integrity of this record only—not the truth or authenticity of the media content.',
    { align: 'justify' }
  );

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });

  const keys = await getSigningKeys();
  const jsonData = {
    data: payload,
    signature: receipt.signature,
    publicKey: keys.publicKey,
    keyId: keys.keyId,
  };

  return {
    pdf: pdfBuffer,
    json: jsonData,
  };
}
