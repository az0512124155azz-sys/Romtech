import { randomBytes, createCipheriv, createDecipheriv, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export const randomId = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, encoded = '') {
  const [salt, expected] = encoded.split(':');
  if (!salt || !/^[a-f0-9]{128}$/.test(expected || '') || typeof password !== 'string' || password.length > 256) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), scryptSync(password, salt, 64));
}
export function encryption(env) {
  const key = Buffer.from(env.ROMTECH_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new AppError(503, 'setup_required', 'נדרשת השלמת הגדרת השרת על ידי בעל האתר.');
  return {
    seal(value) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
    },
    open(value) {
      if (!value) return null;
      const bytes = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'));
    }
  };
}
export function verifyOrigin(req, origin) {
  if (req.headers.origin !== origin || !String(req.headers['content-type'] || '').startsWith('application/json')) {
    throw new AppError(403, 'invalid_origin', 'הבקשה נדחתה. רענן את העמוד ונסה שוב.');
  }
}
export function cookie(req) {
  return String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('rt_owner='))?.slice(9) || '';
}
export function sessionCookie(id, origin, age = 28800) {
  return `rt_owner=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${origin.startsWith('https:') ? '; Secure' : ''}`;
}
