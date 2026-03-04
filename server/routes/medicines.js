// Medicine CRUD routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db/database');
const { parseBill } = require('../services/billParser');
const authMiddleware = require('../middleware/auth');

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.xlsx', '.xls', '.csv'];
    const ext = '.' + file.originalname.toLowerCase().split('.').pop();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, XLSX, XLS, and CSV files are allowed'));
    }
  },
});

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET /api/medicines - Get all medicines for user
router.get('/', (req, res) => {
  const db = getDb();
  const { sort = 'expiry_date', order = 'ASC', search = '' } = req.query;

  // Whitelist sort columns to prevent SQL injection
  const allowedSorts = ['expiry_date', 'medicine_name', 'bill_date', 'distributor_name', 'created_at'];
  const sortColumn = allowedSorts.includes(sort) ? sort : 'expiry_date';
  const sortOrder = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  let query = `SELECT * FROM medicines WHERE user_id = ?`;
  const params = [req.user.id];

  if (search) {
    query += ` AND (medicine_name LIKE ? OR distributor_name LIKE ? OR batch_no LIKE ?)`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  query += ` ORDER BY ${sortColumn} ${sortOrder}`;

  const medicines = db.prepare(query).all(...params);
  res.json(medicines);
});

// POST /api/medicines/upload - Upload and parse a bill
router.post('/upload', upload.single('bill'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const medicines = await parseBill(req.file.buffer, req.file.originalname);

    if (medicines.length === 0) {
      return res.json({
        message: 'No medicine data could be extracted from the file. Please check the file format.',
        medicines: [],
        inserted: 0,
      });
    }

    const db = getDb();
    const insertStmt = db.prepare(`
      INSERT INTO medicines (user_id, medicine_name, expiry_date, batch_no, bill_date, distributor_name, source, source_identifier)
      VALUES (?, ?, ?, ?, ?, ?, 'upload', ?)
    `);

    let inserted = 0;
    const sourceId = `upload_${Date.now()}_${req.file.originalname}`;

    const insertMany = db.transaction((meds) => {
      for (const med of meds) {
        insertStmt.run(
          req.user.id,
          med.medicine_name,
          med.expiry_date,
          med.batch_no,
          med.bill_date,
          med.distributor_name,
          sourceId
        );
        inserted++;
      }
    });

    insertMany(medicines);

    res.json({
      message: `Successfully extracted ${inserted} medicine(s) from the bill.`,
      medicines,
      inserted,
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'Failed to process the uploaded file' });
  }
});

// POST /api/medicines - Add a single medicine manually
router.post('/', (req, res) => {
  const { medicine_name, expiry_date, batch_no, bill_date, distributor_name } = req.body;

  if (!medicine_name) {
    return res.status(400).json({ error: 'Medicine name is required' });
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO medicines (user_id, medicine_name, expiry_date, batch_no, bill_date, distributor_name, source)
    VALUES (?, ?, ?, ?, ?, ?, 'manual')
  `).run(req.user.id, medicine_name, expiry_date || '', batch_no || '', bill_date || '', distributor_name || '');

  const medicine = db.prepare('SELECT * FROM medicines WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(medicine);
});

// PUT /api/medicines/:id - Update a medicine
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { medicine_name, expiry_date, batch_no, bill_date, distributor_name } = req.body;

  const db = getDb();
  const existing = db.prepare('SELECT * FROM medicines WHERE id = ? AND user_id = ?').get(id, req.user.id);

  if (!existing) {
    return res.status(404).json({ error: 'Medicine not found' });
  }

  db.prepare(`
    UPDATE medicines SET 
      medicine_name = ?, expiry_date = ?, batch_no = ?, bill_date = ?, distributor_name = ?
    WHERE id = ? AND user_id = ?
  `).run(
    medicine_name || existing.medicine_name,
    expiry_date ?? existing.expiry_date,
    batch_no ?? existing.batch_no,
    bill_date ?? existing.bill_date,
    distributor_name ?? existing.distributor_name,
    id,
    req.user.id
  );

  const updated = db.prepare('SELECT * FROM medicines WHERE id = ?').get(id);
  res.json(updated);
});

// DELETE /api/medicines/:id - Delete a medicine
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const result = db.prepare('DELETE FROM medicines WHERE id = ? AND user_id = ?').run(id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Medicine not found' });
  }

  res.json({ success: true });
});

// DELETE /api/medicines - Delete multiple medicines
router.delete('/', (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(
    `DELETE FROM medicines WHERE id IN (${placeholders}) AND user_id = ?`
  ).run(...ids, req.user.id);

  res.json({ deleted: result.changes });
});

module.exports = router;
