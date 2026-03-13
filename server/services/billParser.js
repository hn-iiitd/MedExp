// Bill parsing service - extracts medicine data from PDFs and Excel files
// Column matching uses regex with word boundaries (inspired by Python extraction script)
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

// ─── Column matchers (regex with word boundaries, case-insensitive) ───
const COL_PATTERNS = {
  medicine_name: /\b(item\s*name|particulars|item\s*description|description|medicine|drug|product\s*name|product)\b/i,
  batch_no:      /\b(batch\s*no|batchno|batch|b\.?\s*no\.?|lot\s*no|lot)\b/i,
  expiry_date:   /\b(expiry|exp\s*dt|exp\s*date|expiration|exp)\b/i,
  mrp:           /\b(mrp|price|retail\s*price|m\.r\.p|rate)\b/i,
  distributor:   /\b(distributor|supplier|vendor|party|company)\b/i,
  bill_date:     /\b(bill\s*date|invoice\s*date|bill\s*dt|inv\s*date|date)\b/i,
};

/**
 * Match a column header to a known field using regex word-boundary patterns.
 * Returns the field key or null.
 */
function matchColumn(colName) {
  const trimmed = colName.trim();
  for (const [field, regex] of Object.entries(COL_PATTERNS)) {
    if (regex.test(trimmed)) return field;
  }
  return null;
}

// ─── Excel / CSV parsing ───

/**
 * Parse an Excel/CSV buffer and extract medicine data.
 * Optionally accepts senderEmail to use as distributor fallback (for email-sourced files).
 */
function parseExcel(buffer, senderEmail = '') {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const medicines = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (rows.length === 0) continue;

    // Build a mapping: column header → field key
    const headers = Object.keys(rows[0]);
    const colMap = {};
    for (const header of headers) {
      const field = matchColumn(header);
      if (field) colMap[header] = field;
    }

    for (const row of rows) {
      let med = '', batch = '', exp = '', distributor = '', billDate = '';
      let mrp = null;

      for (const [header, field] of Object.entries(colMap)) {
        const val = String(row[header] ?? '').trim();
        if (!val) continue;

        switch (field) {
          case 'medicine_name': med = val; break;
          case 'batch_no':      batch = val; break;
          case 'expiry_date':   exp = val; break;
          case 'distributor':   distributor = val; break;
          case 'bill_date':     billDate = val; break;
          case 'mrp':
            try { mrp = parseFloat(val); if (isNaN(mrp)) mrp = null; }
            catch { mrp = null; }
            break;
        }
      }

      // Accept row if ANY of medicine/batch/expiry was found (matches Python logic)
      if (med || batch || exp) {
        const distributorValue = distributor || senderEmail || '';
        medicines.push({
          medicine_name: med || '-',
          batch_no: batch || '-',
          expiry_date: normalizeDate(exp) || '-',
          bill_date: normalizeDate(billDate),
          distributor_name: distributorValue,
          mrp: mrp,
        });
      }
    }
  }

  return medicines;
}

// ─── PDF parsing ───

/**
 * Parse a PDF buffer and extract medicine data.
 */
async function parsePdf(buffer, senderEmail = '') {
  const data = await pdfParse(buffer);
  const text = data.text;
  return extractMedicineDataFromText(text, senderEmail);
}

/**
 * Extract medicine data from raw PDF text.
 * Strategy 1: Detect a header row and parse subsequent rows as columns.
 * Strategy 2: Regex-based line scanning for batch/expiry patterns.
 */
function extractMedicineDataFromText(text, senderEmail = '') {
  const medicines = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ── Extract bill-level metadata from top of document ──
  let billDate = '';
  let distributorName = '';

  for (const line of lines.slice(0, 20)) {
    if (!billDate) {
      const dateMatch = line.match(
        /(?:date|dt|dated|invoice\s*date|bill\s*date)\s*[:\-]?\s*(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4})/i
      );
      if (dateMatch) billDate = normalizeDate(dateMatch[1]);
    }
    if (!distributorName) {
      const distMatch = line.match(
        /(?:from|distributor|supplier|vendor|m\/s|messrs)\s*[:\-]?\s*(.+)/i
      );
      if (distMatch) distributorName = distMatch[1].trim();
    }
  }

  // Fallback: use first non-numeric line as distributor
  if (!distributorName && lines.length > 0) {
    const first = lines[0].trim();
    if (first.length > 3 && first.length < 100 && !/^\d+$/.test(first)) {
      distributorName = first;
    }
  }

  // Final distributor fallback: sender email
  if (!distributorName) distributorName = senderEmail || '';

  // ── Strategy 1: Tabular header detection ──
  let headerIdx = -1;
  let headerFields = {}; // maps column index → field key

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    // A header must contain at least batch or expiry keywords
    if (/\b(batch|b\.?\s*no)\b/i.test(lower) && /\b(expiry|exp)\b/i.test(lower)) {
      headerIdx = i;
      // Split header into tokens and map each
      const tokens = lines[i].split(/\s{2,}|\t/).map(t => t.trim()).filter(Boolean);
      for (let j = 0; j < tokens.length; j++) {
        const field = matchColumn(tokens[j]);
        if (field) headerFields[j] = field;
      }
      break;
    }
  }

  if (headerIdx >= 0 && Object.keys(headerFields).length >= 2) {
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || /^[\-=_]+$/.test(line) || /\btotal\b/i.test(line)) break;

      const parts = line.split(/\s{2,}|\t/).map(s => s.trim()).filter(Boolean);
      if (parts.length < 2) continue;

      let med = '', batch = '', exp = '', mrp = null;

      for (const [idx, field] of Object.entries(headerFields)) {
        const val = (parts[parseInt(idx)] || '').trim();
        if (!val) continue;
        switch (field) {
          case 'medicine_name': med = val; break;
          case 'batch_no':      batch = val; break;
          case 'expiry_date':   exp = val; break;
          case 'mrp':
            try { mrp = parseFloat(val); if (isNaN(mrp)) mrp = null; }
            catch { mrp = null; }
            break;
        }
      }

      if (med || batch || exp) {
        medicines.push({
          medicine_name: med || '-',
          batch_no: batch || '-',
          expiry_date: normalizeDate(exp) || '-',
          bill_date: billDate,
          distributor_name: distributorName,
          mrp: mrp,
        });
      }
    }
  }

  // ── Strategy 2: Regex line scanning (fallback) ──
  if (medicines.length === 0) {
    const batchRe  = /\b(?:batch|b\.?\s*no\.?|lot)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i;
    const expiryRe = /\b(?:exp(?:iry)?|expiration|exp\s*dt)\s*[:\-]?\s*(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\w{3,9}\s*[\-\/]?\s*\d{2,4})/i;
    const mrpRe    = /\b(?:mrp|price|m\.r\.p)\s*[:\-]?\s*[₹$]?\s*([\d,]+\.?\d*)/i;

    for (const line of lines) {
      const batchMatch  = batchRe.exec(line);
      const expiryMatch = expiryRe.exec(line);
      const mrpMatch    = mrpRe.exec(line);

      if (batchMatch || expiryMatch) {
        // Extract medicine name by removing known patterns
        let name = line
          .replace(/\b(?:batch|b\.?\s*no\.?|lot)\s*[:\-]?\s*[A-Za-z0-9\-\/]+/gi, '')
          .replace(/\b(?:exp(?:iry)?|expiration|exp\s*dt)\s*[:\-]?\s*\S+/gi, '')
          .replace(/\b(?:mrp|price|m\.r\.p)\s*[:\-]?\s*[₹$]?\s*[\d,]+\.?\d*/gi, '')
          .replace(/^\d+[\.\)]\s*/, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        name = name.replace(/[\d\s\.\,]+$/, '').trim();

        let mrp = null;
        if (mrpMatch) {
          try { mrp = parseFloat(mrpMatch[1].replace(/,/g, '')); if (isNaN(mrp)) mrp = null; }
          catch { mrp = null; }
        }

        if (name.length > 1 || batchMatch || expiryMatch) {
          medicines.push({
            medicine_name: name.length > 1 ? name.substring(0, 100) : '-',
            batch_no: batchMatch ? batchMatch[1] : '-',
            expiry_date: expiryMatch ? (normalizeDate(expiryMatch[1]) || '-') : '-',
            bill_date: billDate,
            distributor_name: distributorName,
            mrp: mrp,
          });
        }
      }
    }
  }

  return medicines;
}

// ─── Date normalization ───

/**
 * Normalize various date formats to YYYY-MM-DD.
 */
function normalizeDate(dateStr) {
  if (!dateStr || dateStr === '-') return '';

  const s = String(dateStr).trim();

  // "Mar 2025", "March/2025", "March-2025"
  const monthYear = s.match(/^(\w{3,9})\s*[\-\/]?\s*(\d{4})$/i);
  if (monthYear) {
    const m = parseMonth(monthYear[1]);
    if (m) return `${monthYear[2]}-${m}-01`;
  }

  // "03/2025", "3-2025"
  const mmYYYY = s.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{4})$/);
  if (mmYYYY) {
    return `${mmYYYY[2]}-${mmYYYY[1].padStart(2, '0')}-01`;
  }

  // DD/MM/YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{1,2})\s*[\/.\\-]\s*(\d{4})$/);
  if (ddmmyyyy) {
    return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`;
  }

  // DD/MM/YY
  const ddmmyy = s.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{1,2})\s*[\/.\\-]\s*(\d{2})$/);
  if (ddmmyy) {
    const y = parseInt(ddmmyy[3]) > 50 ? `19${ddmmyy[3]}` : `20${ddmmyy[3]}`;
    return `${y}-${ddmmyy[2].padStart(2, '0')}-${ddmmyy[1].padStart(2, '0')}`;
  }

  // "MM/YY" e.g. "03/26"
  const mmyy = s.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{2})$/);
  if (mmyy) {
    const y = parseInt(mmyy[2]) > 50 ? `19${mmyy[2]}` : `20${mmyy[2]}`;
    return `${y}-${mmyy[1].padStart(2, '0')}-01`;
  }

  // "Mar-26", "Mar 26" (month-year short)
  const monYY = s.match(/^(\w{3,9})\s*[\-\/]?\s*(\d{2})$/i);
  if (monYY) {
    const m = parseMonth(monYY[1]);
    if (m) {
      const y = parseInt(monYY[2]) > 50 ? `19${monYY[2]}` : `20${monYY[2]}`;
      return `${y}-${m}-01`;
    }
  }

  return s;
}

function parseMonth(monthStr) {
  const months = {
    jan: '01', january: '01',
    feb: '02', february: '02',
    mar: '03', march: '03',
    apr: '04', april: '04',
    may: '05',
    jun: '06', june: '06',
    jul: '07', july: '07',
    aug: '08', august: '08',
    sep: '09', september: '09',
    oct: '10', october: '10',
    nov: '11', november: '11',
    dec: '12', december: '12',
  };
  return months[monthStr.toLowerCase()] || null;
}

// ─── Entry point ───

/**
 * Parse a bill file (PDF, Excel, CSV).
 * senderEmail is optionally passed from email-fetch flow for distributor fallback.
 */
async function parseBill(buffer, filename, senderEmail = '') {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    return await parsePdf(buffer, senderEmail);
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return parseExcel(buffer, senderEmail);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

module.exports = { parseBill, parsePdf, parseExcel };
