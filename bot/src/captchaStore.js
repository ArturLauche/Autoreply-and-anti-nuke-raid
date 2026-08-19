/**
 * Captcha store for verify flow: guildId:userId -> { code, expiresAt }
 * Used by interactionCreate.js (send captcha) and messageCreate.js (verify code).
 */
const store = new Map();

function genCaptcha() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function setCode(guildId, userId, code) {
  store.set(`${guildId}:${userId}`, { code, expiresAt: Date.now() + 5 * 60_000 });
}

function verifyCode(guildId, userId, input) {
  const key = `${guildId}:${userId}`;
  const entry = store.get(key);
  if (!entry) return { ok: false, reason: "no_code" };
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return { ok: false, reason: "expired" };
  }
  if (entry.code !== input.trim()) return { ok: false, reason: "wrong" };
  store.delete(key);
  return { ok: true };
}

// Dọn entry hết hạn mỗi 5 phút
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now > v.expiresAt) store.delete(k);
  }
}, 300_000);

module.exports = { genCaptcha, setCode, verifyCode };
