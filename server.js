const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { startPairing, getSession } = require('./baileys');
const { getNews } = require('./news');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ============ PAIRING ============ */
app.post('/api/pair/start', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ ok: false, err: 'phone wajib' });
    const clean = phone.replace(/\D/g, '');
    if (!/^628\d{7,13}$/.test(clean))
      return res.status(400).json({ ok: false, err: 'format 628xxxx' });
    const code = await startPairing(clean);
    res.json({ ok: true, phone: clean, pairingCode: code });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

app.get('/api/sessions', (req, res) => {
  const rows = db.prepare(`SELECT phone, created_at, last_seen FROM sessions ORDER BY last_seen DESC`).all();
  res.json({ ok: true, sessions: rows });
});

/* ============ NEWS (Berita Indonesia) ============ */
app.get('/api/news', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '12', 10), 30);
    const items = await getNews(limit);
    res.json({ ok: true, total: items.length, news: items });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

/* ============ MASS REPORT (Ban User / Ban Group) ============ */
app.post('/api/report', async (req, res) => {
  try {
    const { senderPhone, target, targetType, count = 10, delayMs = 1500 } = req.body;

    if (!senderPhone || !target)
      return res.status(400).json({ ok: false, err: 'senderPhone & target wajib' });
    if (!['user', 'group'].includes(targetType))
      return res.status(400).json({ ok: false, err: 'targetType harus user/group' });
    if (count < 1 || count > 100)
      return res.status(400).json({ ok: false, err: 'count 1-100' });

    // Cek session harus ada (sender pribadi WAJIB)
    const sess = db.prepare(`SELECT phone FROM sessions WHERE phone = ?`).get(senderPhone);
    if (!sess) return res.status(400).json({ ok: false, err: 'sender pribadi belum pairing' });

    // Log report (belum ada eksekusi kirim — placeholder)
    const info = db.prepare(`INSERT INTO reports (sender_phone, target, target_type, count, delay_ms, status, created_at)
                              VALUES (?, ?, ?, ?, ?, 'queued', ?)`)
      .run(senderPhone, target, targetType, count, delayMs, Date.now());

    db.prepare(`INSERT INTO logs (session_phone, target, type, detail, ts)
                VALUES (?, ?, 'mass-report', ?, ?)`)
      .run(senderPhone, target, `count=${count} delay=${delayMs}ms type=${targetType}`, Date.now());

    // TODO: logika eksekusi report via Baileys nanti
    // const sock = await getSession(senderPhone);
    // ... loop count kali report ...

    res.json({
      ok: true,
      id: info.lastInsertRowid,
      msg: 'Mass report di-queue (logika kirim belum diimplementasi)',
      target, targetType, count, delayMs
    });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

/* ============ SEND BUG (placeholder) ============ */
app.post('/api/send', async (req, res) => {
  try {
    const { sessionPhone, target, bug, sender = 'global', type = 'bug-user' } = req.body;
    if (!sessionPhone || !target)
      return res.status(400).json({ ok: false, err: 'sessionPhone & target wajib' });

    db.prepare(`INSERT INTO logs (session_phone, target, type, detail, ts)
                VALUES (?, ?, ?, ?, ?)`)
      .run(sessionPhone, target, type, `bug=${bug} sender=${sender}`, Date.now());

    // TODO: logika kirim bug via Baileys nanti
    res.json({ ok: true, msg: 'Payload di-queue', bug, target, sender, type });
  } catch (e) {
    res.status(500).json({ ok: false, err: e.message });
  }
});

/* ============ LOGS ============ */
app.get('/api/logs', (req, res) => {
  const rows = db.prepare(`SELECT * FROM logs ORDER BY ts DESC LIMIT 100`).all();
  res.json({ ok: true, logs: rows });
});

app.get('/api/reports', (req, res) => {
  const rows = db.prepare(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 50`).all();
  res.json({ ok: true, reports: rows });
});

/* ============ START ============ */
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Shix running on :${PORT}`);
});
