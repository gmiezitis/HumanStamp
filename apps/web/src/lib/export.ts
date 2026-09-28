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

  const pageWidth = doc.page.width;
  const leftMargin = doc.page.margins.left;
  const rightMargin = doc.page.margins.right;
  const contentWidth = pageWidth - leftMargin - rightMargin;

  // Header box with brand
  doc.save();
  doc.fillColor('#09090b')
    .rect(leftMargin, 40, contentWidth, 80)
    .fill();
  
  doc.fillColor('#ffffff')
    .fontSize(28)
    .font('Helvetica-Bold')
    .text('HUMAN STAMP', leftMargin, 55, { align: 'center', width: contentWidth });
  
  doc.fontSize(14)
    .font('Helvetica')
    .text('Record of Approval and Disclosure', leftMargin, 85, { align: 'center', width: contentWidth });
  doc.restore();

  doc.moveDown(7);
  doc.fontSize(9).fillColor('#71717a').text(`Receipt ID: ${receiptId}`, { align: 'center' });
  doc.moveDown(1);

  // Project box
  const boxPadding = 12;
  let boxY = doc.y;
  doc.save();
  doc.fillColor('#fafafa')
    .rect(leftMargin, boxY, contentWidth, 70)
    .fill()
    .strokeColor('#e4e4e7')
    .rect(leftMargin, boxY, contentWidth, 70)
    .stroke();
  doc.restore();

  doc.fillColor('#09090b')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('PROJECT', leftMargin + boxPadding, boxY + boxPadding);
  doc.font('Helvetica')
    .fontSize(10)
    .text(`Client: ${payload.project.client.name}`, leftMargin + boxPadding, boxY + boxPadding + 18);
  doc.text(`Project: ${payload.project.name}`, leftMargin + boxPadding, boxY + boxPadding + 33);
  
  doc.y = boxY + 80;

  // Version box
  boxY = doc.y;
  doc.save();
  doc.fillColor('#fafafa')
    .rect(leftMargin, boxY, contentWidth, 85)
    .fill()
    .strokeColor('#e4e4e7')
    .rect(leftMargin, boxY, contentWidth, 85)
    .stroke();
  doc.restore();

  doc.fillColor('#09090b')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('VERSION', leftMargin + boxPadding, boxY + boxPadding);
  doc.font('Helvetica')
    .fontSize(10)
    .text(`Version: v${payload.versionNumber}`, leftMargin + boxPadding, boxY + boxPadding + 18);
  doc.text(`Filename: ${payload.filename}`, leftMargin + boxPadding, boxY + boxPadding + 33);
  doc.text(`AI Claim: ${payload.aiClaim}`, leftMargin + boxPadding, boxY + boxPadding + 48);
  doc.text(`C2PA Present: ${payload.c2paPresent ? 'Yes' : 'No'}`, leftMargin + boxPadding, boxY + boxPadding + 63);
  
  doc.y = boxY + 95;

  // Approvals box
  if (payload.approvals.length > 0) {
    const approvalBoxHeight = 55 + (payload.approvals.length * 25);
    boxY = doc.y;
    doc.save();
    doc.fillColor('#f0fdf4')
      .rect(leftMargin, boxY, contentWidth, approvalBoxHeight)
      .fill()
      .strokeColor('#bbf7d0')
      .rect(leftMargin, boxY, contentWidth, approvalBoxHeight)
      .stroke();
    doc.restore();

    doc.fillColor('#09090b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('INTERNAL APPROVALS', leftMargin + boxPadding, boxY + boxPadding);
    
    let approvalY = boxY + boxPadding + 18;
    for (const approval of payload.approvals) {
      doc.font('Helvetica')
        .fontSize(9)
        .text(
          `✓ ${approval.approverName ? `${approval.approverName}, ` : ''}${approval.approverRole} at ${approval.company}`,
          leftMargin + boxPadding,
          approvalY
        );
      doc.fontSize(8)
        .fillColor('#71717a')
        .text(`  ${new Date(approval.createdAt).toLocaleString()}`, leftMargin + boxPadding + 10, approvalY + 12);
      doc.fillColor('#09090b');
      approvalY += 25;
    }
    doc.y = boxY + approvalBoxHeight + 10;
  }

  // Client sign-offs box
  if (payload.clientSignOffs.length > 0) {
    const signoffBoxHeight = 55 + (payload.clientSignOffs.length * 25);
    boxY = doc.y;
    doc.save();
    doc.fillColor('#eff6ff')
      .rect(leftMargin, boxY, contentWidth, signoffBoxHeight)
      .fill()
      .strokeColor('#bfdbfe')
      .rect(leftMargin, boxY, contentWidth, signoffBoxHeight)
      .stroke();
    doc.restore();

    doc.fillColor('#09090b')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('CLIENT SIGN-OFFS', leftMargin + boxPadding, boxY + boxPadding);
    
    let signoffY = boxY + boxPadding + 18;
    for (const signoff of payload.clientSignOffs) {
      doc.font('Helvetica')
        .fontSize(9)
        .text(
          `✓ ${signoff.signerName} (${signoff.email}) — ${signoff.decision}`,
          leftMargin + boxPadding,
          signoffY
        );
      doc.fontSize(8)
        .fillColor('#71717a')
        .text(`  ${new Date(signoff.createdAt).toLocaleString()}`, leftMargin + boxPadding + 10, signoffY + 12);
      doc.fillColor('#09090b');
      signoffY += 25;
    }
    doc.y = boxY + signoffBoxHeight + 10;
  }

  // AI Label box
  const labelBoxHeight = payload.aiLabel ? 115 : 65;
  boxY = doc.y;
  doc.save();
  doc.fillColor('#fef3c7')
    .rect(leftMargin, boxY, contentWidth, labelBoxHeight)
    .fill()
    .strokeColor('#fde047')
    .rect(leftMargin, boxY, contentWidth, labelBoxHeight)
    .stroke();
  doc.restore();

  doc.fillColor('#09090b')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('VISIBLE AI LABEL (applied by the agency)', leftMargin + boxPadding, boxY + boxPadding);
  
  if (payload.aiLabel) {
    doc.font('Helvetica')
      .fontSize(9)
      .text(`Label Text: ${payload.aiLabel.labelText}`, leftMargin + boxPadding, boxY + boxPadding + 18);
    doc.text(`Position: ${payload.aiLabel.corner}`, leftMargin + boxPadding, boxY + boxPadding + 33);
    doc.text(`Applied: ${new Date(payload.aiLabel.appliedAt).toLocaleString()}`, leftMargin + boxPadding, boxY + boxPadding + 48);
    doc.fontSize(7)
      .fillColor('#71717a')
      .text(`Labeled File SHA-256: ${payload.aiLabel.labeledFileSha256}`, leftMargin + boxPadding, boxY + boxPadding + 63, {
        width: contentWidth - (boxPadding * 2),
      });
    doc.fillColor('#09090b');
    doc.fontSize(8)
      .font('Helvetica')
      .text('Whether a label is legally required, and in what form, is the deployer\'s own assessment.', leftMargin + boxPadding, boxY + boxPadding + 80, {
        width: contentWidth - (boxPadding * 2),
      });
  } else {
    doc.font('Helvetica')
      .fontSize(9)
      .text('No label applied', leftMargin + boxPadding, boxY + boxPadding + 18);
    doc.fontSize(8)
      .text('Whether a label is legally required, and in what form, is the deployer\'s own assessment.', leftMargin + boxPadding, boxY + boxPadding + 33, {
        width: contentWidth - (boxPadding * 2),
      });
  }
  
  doc.y = boxY + labelBoxHeight + 10;

  // File hash box
  boxY = doc.y;
  doc.save();
  doc.fillColor('#fafafa')
    .rect(leftMargin, boxY, contentWidth, 45)
    .fill()
    .strokeColor('#e4e4e7')
    .rect(leftMargin, boxY, contentWidth, 45)
    .stroke();
  doc.restore();

  doc.fillColor('#09090b')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('FILE SHA-256 HASH', leftMargin + boxPadding, boxY + boxPadding);
  doc.font('Courier')
    .fontSize(7)
    .fillColor('#71717a')
    .text(payload.sha256, leftMargin + boxPadding, boxY + boxPadding + 18, {
      width: contentWidth - (boxPadding * 2),
    });
  doc.fillColor('#09090b');
  
  doc.y = boxY + 55;

  // Created timestamp
  doc.font('Helvetica')
    .fontSize(9)
    .fillColor('#71717a')
    .text(`Created: ${new Date(payload.createdAt).toLocaleString()}`, { align: 'center' });
  doc.moveDown(1.5);

  // Signature badge
  doc.save();
  const badgeY = doc.y;
  doc.fillColor('#10b981')
    .roundedRect(leftMargin + (contentWidth / 2) - 80, badgeY, 160, 40, 4)
    .fill();
  doc.fillColor('#ffffff')
    .fontSize(9)
    .font('Helvetica-Bold')
    .text('✓ RECEIPT DATA SIGNED', leftMargin, badgeY + 7, {
      width: contentWidth,
      align: 'center',
    });
  doc.fontSize(7)
    .font('Helvetica')
    .text('(Ed25519)', leftMargin, badgeY + 22, {
      width: contentWidth,
      align: 'center',
    });
  doc.restore();
  
  doc.moveDown(2.5);

  // Legal disclaimer
  doc.font('Helvetica')
    .fontSize(7)
    .fillColor('#a1a1aa')
    .text(
      'Legal Disclaimer: This record documents approvals and disclosures. It is not legal advice or a certification of compliance. ' +
      'The cryptographic signature verifies the integrity of this record only—not the truth or authenticity of the media content.',
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
    publicKey: receipt.publicKey,  // Use the key from the receipt, not current signing key
    keyId: receipt.keyId,
  };

  return {
    pdf: pdfBuffer,
    json: jsonData,
  };
}
