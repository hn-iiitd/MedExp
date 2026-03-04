// Bill parsing service - extracts medicine data from PDFs and Excel files
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');

/**
 * Parse a PDF buffer and extract medicine data.
 * Uses text extraction and pattern matching.
 */
async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  const text = data.text;
  return extractMedicineData(text);
}

/**
 * Parse an Excel buffer and extract medicine data.
 */
function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const medicines = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    for (const row of rows) {
      const medicine = mapExcelRow(row);
      if (medicine && medicine.medicine_name) {
        medicines.push(medicine);
      }
    }
  }

  return medicines;
}

/**
 * Map an Excel row to medicine data by matching common column name patterns.
 */
function mapExcelRow(row) {
  const keys = Object.keys(row);
  const find = (patterns) => {
    for (const key of keys) {
      const lower = key.toLowerCase().trim();
      for (const p of patterns) {
        if (lower.includes(p)) return row[key];
      }
    }
    return '';
  };

  const medicineName = find(['medicine', 'drug', 'product', 'item', 'name', 'description', 'particulars']);
  const expiry = find(['expiry', 'exp', 'expiration', 'exp.', 'exp date']);
  const batchNo = find(['batch', 'lot', 'b.no', 'b no', 'batch no']);
  const billDate = find(['bill date', 'invoice date', 'date', 'bill dt']);
  const distributor = find(['distributor', 'supplier', 'vendor', 'party', 'company', 'from']);

  if (!medicineName) return null;

  return {
    medicine_name: String(medicineName).trim(),
    expiry_date: normalizeDate(String(expiry).trim()),
    batch_no: String(batchNo).trim(),
    bill_date: normalizeDate(String(billDate).trim()),
    distributor_name: String(distributor).trim(),
  };
}

/**
 * Extract medicine data from raw text (PDF content).
 * Tries multiple strategies: tabular, line-by-line pattern matching.
 */
function extractMedicineData(text) {
  const medicines = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Strategy 1: Look for tabular data patterns
  // Common bill formats have columns: S.No | Name | Batch | Expiry | Qty | Rate | Amount
  let headerIndex = -1;
  let columnMap = {};

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (
      (lower.includes('batch') || lower.includes('b.no')) &&
      (lower.includes('expiry') || lower.includes('exp'))
    ) {
      headerIndex = i;
      columnMap = detectColumns(lines[i]);
      break;
    }
  }

  // Strategy 2: Extract bill-level info (date, distributor)
  let billDate = '';
  let distributorName = '';

  for (const line of lines.slice(0, 15)) {
    // Look for date patterns
    if (!billDate) {
      const dateMatch = line.match(
        /(?:date|dt|dated|invoice date|bill date)\s*[:\-]?\s*(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4})/i
      );
      if (dateMatch) billDate = normalizeDate(dateMatch[1]);
    }
    // Look for distributor/company name in first few lines
    if (!distributorName) {
      const distMatch = line.match(
        /(?:from|distributor|supplier|vendor|m\/s|messrs)\s*[:\-]?\s*(.+)/i
      );
      if (distMatch) distributorName = distMatch[1].trim();
    }
  }

  // If no distributor found, use first line as company name (common in invoices)
  if (!distributorName && lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length > 3 && firstLine.length < 100 && !/^\d+$/.test(firstLine)) {
      distributorName = firstLine;
    }
  }

  if (headerIndex >= 0) {
    // Parse tabular data after header
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line || line.match(/^[\-=_]+$/) || line.toLowerCase().includes('total')) break;

      const medicine = parseTabularLine(line, columnMap);
      if (medicine && medicine.medicine_name) {
        medicine.bill_date = medicine.bill_date || billDate;
        medicine.distributor_name = medicine.distributor_name || distributorName;
        medicines.push(medicine);
      }
    }
  }

  // Strategy 3: If no tabular data found, try regex-based extraction
  if (medicines.length === 0) {
    const batchRegex = /(?:batch|b\.?\s*no\.?|lot)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/gi;
    const expiryRegex =
      /(?:exp(?:iry)?|expiration)\s*[:\-]?\s*(\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\w{3,9}\s*[\-\/]?\s*\d{2,4})/gi;

    let match;
    const entries = [];

    for (const line of lines) {
      const batchMatch = batchRegex.exec(line);
      const expiryMatch = expiryRegex.exec(line);
      batchRegex.lastIndex = 0;
      expiryRegex.lastIndex = 0;

      if (batchMatch || expiryMatch) {
        // Try to extract medicine name from the same line
        let name = line
          .replace(batchRegex, '')
          .replace(expiryRegex, '')
          .replace(/\d+[\.\)]\s*/, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        // Remove trailing numbers (quantities, rates, etc.)
        name = name.replace(/[\d\s\.\,]+$/, '').trim();

        if (name.length > 2) {
          entries.push({
            medicine_name: name.substring(0, 100),
            expiry_date: expiryMatch ? normalizeDate(expiryMatch[1]) : '',
            batch_no: batchMatch ? batchMatch[1] : '',
            bill_date: billDate,
            distributor_name: distributorName,
          });
        }
      }
    }

    medicines.push(...entries);
  }

  return medicines;
}

/**
 * Detect column positions from a header line.
 */
function detectColumns(headerLine) {
  const lower = headerLine.toLowerCase();
  const cols = {};

  const patterns = [
    { key: 'name', regex: /(?:name|product|item|particulars|description)/i },
    { key: 'batch', regex: /(?:batch|b\.?\s*no|lot)/i },
    { key: 'expiry', regex: /(?:expiry|exp\.?\s*(?:date)?|expiration)/i },
    { key: 'date', regex: /(?:bill\s*date|invoice\s*date|date)/i },
  ];

  for (const p of patterns) {
    const match = p.regex.exec(lower);
    if (match) {
      cols[p.key] = match.index;
    }
  }

  return cols;
}

/**
 * Parse a single tabular line using column positions.
 */
function parseTabularLine(line) {
  // Split by multiple spaces or tabs (common in PDF-extracted tables)
  const parts = line.split(/\s{2,}|\t/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  // Try to identify batch number and expiry date in the parts
  let name = '';
  let batch = '';
  let expiry = '';

  for (const part of parts) {
    const isDate = /\d{1,2}[\/.\\-]\d{1,2}[\/.\\-]\d{2,4}|\w{3}\s*[\-\/]?\s*\d{2,4}/i.test(part);
    const isBatch = /^[A-Za-z]{1,3}[\-\/]?\d{2,}/i.test(part) && !isDate;
    const isNumber = /^\d+[\.\,]?\d*$/.test(part);

    if (isDate && !expiry) {
      expiry = normalizeDate(part);
    } else if (isBatch && !batch) {
      batch = part;
    } else if (!isNumber && !name) {
      name = part;
    }
  }

  if (!name) return null;

  return {
    medicine_name: name.substring(0, 100),
    expiry_date: expiry,
    batch_no: batch,
    bill_date: '',
    distributor_name: '',
  };
}

/**
 * Normalize various date formats to YYYY-MM-DD or MM/YYYY.
 */
function normalizeDate(dateStr) {
  if (!dateStr) return '';

  // Handle Month-Year format: "Mar 2025", "March/2025", "03/2025"
  const monthYearMatch = dateStr.match(
    /^(\w{3,9})\s*[\-\/]?\s*(\d{4})$/i
  );
  if (monthYearMatch) {
    const month = parseMonth(monthYearMatch[1]);
    if (month) return `${monthYearMatch[2]}-${month}-01`;
  }

  // Handle MM/YYYY
  const mmYYYY = dateStr.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{4})$/);
  if (mmYYYY) {
    const m = mmYYYY[1].padStart(2, '0');
    return `${mmYYYY[2]}-${m}-01`;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{1,2})\s*[\/.\\-]\s*(\d{4})$/);
  if (ddmmyyyy) {
    const d = ddmmyyyy[1].padStart(2, '0');
    const m = ddmmyyyy[2].padStart(2, '0');
    return `${ddmmyyyy[3]}-${m}-${d}`;
  }

  // Handle DD/MM/YY or DD-MM-YY
  const ddmmyy = dateStr.match(/^(\d{1,2})\s*[\/.\\-]\s*(\d{1,2})\s*[\/.\\-]\s*(\d{2})$/);
  if (ddmmyy) {
    const d = ddmmyy[1].padStart(2, '0');
    const m = ddmmyy[2].padStart(2, '0');
    const y = parseInt(ddmmyy[3]) > 50 ? `19${ddmmyy[3]}` : `20${ddmmyy[3]}`;
    return `${y}-${m}-${d}`;
  }

  return dateStr;
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

/**
 * Identify file type and parse accordingly.
 */
async function parseBill(buffer, filename) {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'pdf') {
    return await parsePdf(buffer);
  } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return parseExcel(buffer);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

module.exports = { parseBill, parsePdf, parseExcel };
