// Email fetching routes - fetch bills from Gmail
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { fetchEmailsWithAttachments, getEmailDetails, getAttachment } = require('../services/googleAuth');
const { parseBill } = require('../services/billParser');

router.use(authMiddleware);

// POST /api/emails/fetch - Fetch and process bill attachments from Gmail
router.post('/fetch', async (req, res) => {
  try {
    const db = getDb();
    const user = req.user;

    if (!user.access_token) {
      return res.status(400).json({ error: 'Gmail access not available. Please re-login with Google.' });
    }

    // Get emails with attachments
    const messages = await fetchEmailsWithAttachments(user.access_token, user.refresh_token);

    if (messages.length === 0) {
      return res.json({
        message: 'No emails with bill attachments found in the last 6 months.',
        processed: 0,
        medicines: [],
      });
    }

    // Filter out already processed emails
    const processedEmails = db.prepare(
      'SELECT message_id FROM processed_emails WHERE user_id = ?'
    ).all(user.id).map(r => r.message_id);

    const newMessages = messages.filter(m => !processedEmails.includes(m.id));

    if (newMessages.length === 0) {
      return res.json({
        message: 'All emails have already been processed. No new bills found.',
        processed: 0,
        medicines: [],
      });
    }

    let totalMedicines = [];
    let processedCount = 0;
    const errors = [];

    const insertMedicine = db.prepare(`
      INSERT INTO medicines (user_id, medicine_name, expiry_date, batch_no, bill_date, distributor_name, mrp, source, source_identifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'email', ?)
    `);

    const insertProcessed = db.prepare(`
      INSERT OR IGNORE INTO processed_emails (user_id, message_id, subject)
      VALUES (?, ?, ?)
    `);

    for (const msg of newMessages.slice(0, 20)) {
      // Limit to 20 messages per fetch to avoid timeout
      try {
        const emailDetails = await getEmailDetails(user.access_token, user.refresh_token, msg.id);
        const subject = emailDetails.payload?.headers?.find(h => h.name.toLowerCase() === 'subject')?.value || '';

        // Extract sender email for distributor fallback
        const fromHeader = emailDetails.payload?.headers?.find(h => h.name.toLowerCase() === 'from')?.value || '';
        const emailMatch = fromHeader.match(/[\w.\-]+@[\w.\-]+\.\w+/);
        const senderEmail = emailMatch ? emailMatch[0] : '';

        // Find attachments
        const attachments = findAttachments(emailDetails.payload);

        for (const att of attachments) {
          try {
            const buffer = await getAttachment(user.access_token, user.refresh_token, msg.id, att.attachmentId);
            const medicines = await parseBill(buffer, att.filename, senderEmail);

            if (medicines.length > 0) {
              const transaction = db.transaction(() => {
                for (const med of medicines) {
                  insertMedicine.run(
                    user.id,
                    med.medicine_name,
                    med.expiry_date,
                    med.batch_no,
                    med.bill_date,
                    med.distributor_name,
                    med.mrp,
                    `email_${msg.id}_${att.filename}`
                  );
                }
              });
              transaction();
              totalMedicines.push(...medicines);
            }
          } catch (parseErr) {
            errors.push(`Failed to parse ${att.filename}: ${parseErr.message}`);
          }
        }

        // Mark email as processed
        insertProcessed.run(user.id, msg.id, subject);
        processedCount++;
      } catch (emailErr) {
        errors.push(`Failed to process email ${msg.id}: ${emailErr.message}`);
      }
    }

    res.json({
      message: `Processed ${processedCount} email(s). Found ${totalMedicines.length} medicine(s).`,
      processed: processedCount,
      medicines: totalMedicines,
      errors: errors.length > 0 ? errors : undefined,
      remaining: Math.max(0, newMessages.length - 20),
    });
  } catch (err) {
    console.error('Email fetch error:', err);

    if (err.message?.includes('invalid_grant') || err.code === 401) {
      return res.status(401).json({
        error: 'Gmail access expired. Please re-login with Google.',
        reauth: true,
      });
    }

    res.status(500).json({ error: 'Failed to fetch emails. ' + (err.message || '') });
  }
});

// GET /api/emails/status - Check how many emails have been processed
router.get('/status', (req, res) => {
  const db = getDb();
  const count = db.prepare(
    'SELECT COUNT(*) as count FROM processed_emails WHERE user_id = ?'
  ).get(req.user.id);

  res.json({ processedCount: count.count });
});

/**
 * Recursively find attachments in email payload (handles multipart).
 */
function findAttachments(payload, attachments = []) {
  if (!payload) return attachments;

  if (payload.parts) {
    for (const part of payload.parts) {
      findAttachments(part, attachments);
    }
  }

  if (payload.body?.attachmentId && payload.filename) {
    const ext = payload.filename.toLowerCase().split('.').pop();
    if (['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) {
      attachments.push({
        filename: payload.filename,
        attachmentId: payload.body.attachmentId,
        mimeType: payload.mimeType,
      });
    }
  }

  return attachments;
}

module.exports = router;
