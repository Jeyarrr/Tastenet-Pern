import { Router } from 'express';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { authenticate, cookieOptions, createSession, deleteSession } from '../auth.js';
import { HttpError } from '../errors.js';
import { validate } from '../validate.js';

const registerSchema = z.strictObject({
  username: z.string().trim().min(3).max(80).regex(/^[\p{L}\p{N}_.-]+$/u),
  email: z.email().max(320).transform(value => value.toLowerCase()),
  password: z.string().min(12).max(128)
    .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long for bcrypt'),
  fullName: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  gender: z.enum(['Male', 'Female', '']).optional(),
  address: z.string().trim().max(1000).optional()
});
const loginSchema = z.strictObject({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1),
  rememberMe: z.boolean().optional()
});

function publicUser(user) {
  return { id: user.id, username: user.username, email: user.email,
    fullName: user.full_name, role: user.role };
}

export function authRouter(db, config) {
  const router = Router();
  const requireAuth = authenticate(db, config);

  router.post('/register', validate(registerSchema), async (req, res) => {
    const { username, email, password, fullName, phone, gender, address } = req.validated;
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO tastenet.users (username, email, password_hash, full_name, phone, gender, address, role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'customer')
       RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, fullName, phone ?? null, gender ?? null, address ?? null]
    );
    res.status(201).json({ user: publicUser(result.rows[0]) });
  });

  router.post('/login', validate(loginSchema), async (req, res) => {
    const { identifier, password } = req.validated;
    const result = await db.query(
      `SELECT id, username, email, password_hash, full_name, role, is_active
         FROM tastenet.users WHERE lower(username) = lower($1) OR lower(email) = lower($1)
         LIMIT 1`, [identifier]
    );
    const user = result.rows[0];
    if (!user || !user.password_hash || !await bcrypt.compare(password, user.password_hash)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid username or password');
    }
    if (!user.is_active) throw new HttpError(403, 'ACCOUNT_INACTIVE', 'Account inactive');
    const token = await createSession(db, user.id, config);
    res.cookie(config.SESSION_COOKIE_NAME, token, { ...cookieOptions(config),
      maxAge: req.validated.rememberMe ? cookieOptions(config).maxAge : undefined });
    res.json({ user: publicUser(user) });
  });

  router.post('/logout', async (req, res) => {
    await deleteSession(db, req.cookies?.[config.SESSION_COOKIE_NAME]);
    res.clearCookie(config.SESSION_COOKIE_NAME, { ...cookieOptions(config), maxAge: undefined });
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
  const profileColumns = `id, username, email, full_name, phone, gender, address, role,
    rider_status, vehicle, vehicle_model, license_plate, ratings, date_joined, created_at`;
  router.get('/profile', requireAuth, async (req, res) => {
    const result = await db.query(`SELECT ${profileColumns} FROM tastenet.users WHERE id = $1`, [req.user.id]);
    res.json({ profile: result.rows[0] });
  });
  router.patch('/profile', requireAuth, validate(z.strictObject({
    fullName: z.string().trim().min(1).max(200), phone: z.string().trim().max(40),
    gender: z.enum(['Male', 'Female', '']), address: z.string().trim().max(1000)
  })), async (req, res) => {
    const v = req.validated;
    const result = await db.query(`UPDATE tastenet.users SET full_name=$1, phone=$2,
      gender=$3, address=$4, updated_at=now() WHERE id=$5 RETURNING ${profileColumns}`,
    [v.fullName, v.phone, v.gender, v.address, req.user.id]);
    res.json({ profile: result.rows[0] });
  });
  router.patch('/password', requireAuth, validate(z.strictObject({
    currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128)
      .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password is too long for bcrypt')
  })), async (req, res) => {
    const result = await db.query('SELECT password_hash FROM tastenet.users WHERE id=$1', [req.user.id]);
    if (!result.rows[0]?.password_hash || !await bcrypt.compare(req.validated.currentPassword, result.rows[0].password_hash))
      throw new HttpError(400, 'INVALID_PASSWORD', 'Current password is incorrect');
    const passwordHash = await bcrypt.hash(req.validated.newPassword, 12);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE tastenet.users SET password_hash=$1, updated_at=now() WHERE id=$2', [passwordHash, req.user.id]);
      const currentTokenHash = createHash('sha256').update(req.cookies[config.SESSION_COOKIE_NAME]).digest('hex');
      await client.query('DELETE FROM tastenet.auth_sessions WHERE user_id=$1 AND token_hash<>$2', [req.user.id, currentTokenHash]);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    res.json({ message: 'Password changed' });
  });
  router.patch('/availability', requireAuth, validate(z.strictObject({ status: z.enum(['online', 'offline']) })), async (req, res) => {
    if (req.user.role !== 'rider') throw new HttpError(403, 'FORBIDDEN', 'Rider account required');
    await db.query('UPDATE tastenet.users SET rider_status=$1, updated_at=now() WHERE id=$2', [req.validated.status, req.user.id]);
    res.json({ status: req.validated.status });
  });
  return router;
}
