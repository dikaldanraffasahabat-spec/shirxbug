const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const db = require('./db');

const SESS_DIR = './sessions';
if (!fs.existsSync(SESS_DIR)) fs.mkdirSync(SESS_DIR, { recursive: true });

const active = new Map();

async function startPairing(phone) {
  const dir = path.join(SESS_DIR, phone);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome'),
    syncFullHistory: false,
    markOnlineOnConnect: false
  });

  sock.ev.on('creds.update', saveCreds);

  let code = null;
  if (!sock.authState.creds.registered) {
    const clean = phone.replace(/\D/g, '');
    await new Promise(r => setTimeout(r, 1200));
    code = await sock.requestPairingCode(clean);
  }

  active.set(phone, { sock, code });

  sock.ev.on('connection.update', (u) => {
    if (u.connection === 'open') {
      const credsPath = path.join(dir, 'creds.json');
      const creds = fs.readFileSync(credsPath, 'utf-8');
      const now = Date.now();
      db.prepare(`INSERT INTO sessions (phone, creds, created_at, last_seen)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(phone) DO UPDATE SET creds=excluded.creds, last_seen=excluded.last_seen`)
        .run(phone, creds, now, now);
      console.log(`[PAIR-OK] ${phone}`);
    }
  });

  return code;
}

async function getSession(phone) {
  if (active.has(phone) && active.get(phone).sock?.user) {
    return active.get(phone).sock;
  }
  const row = db.prepare(`SELECT creds FROM sessions WHERE phone = ?`).get(phone);
  if (!row) return null;

  const dir = path.join(SESS_DIR, phone);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'creds.json'), row.creds);

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
    },
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: Browsers.ubuntu('Chrome')
  });
  sock.ev.on('creds.update', saveCreds);
  await new Promise((res) => {
    const t = setTimeout(res, 8000);
    sock.ev.on('connection.update', s => { if (s.connection === 'open') { clearTimeout(t); res(); } });
  });
  active.set(phone, { sock });
  return sock;
}

module.exports = { startPairing, getSession, active };
