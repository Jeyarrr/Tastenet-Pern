// Read-only route checks against the running local API. Temporary test sessions
// use existing role accounts and are deleted afterward. No passwords are read.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPool } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createSession } from '../src/auth.js';

const config = readConfig();
const db = createPool(config.DATABASE_URL);
const base = `http://localhost:${config.PORT}`;
const tokens = [];
try {
  assert.equal((await fetch(`${base}/health/ready`)).status, 200);
  for (const role of ['customer', 'admin', 'rider', 'superadmin']) {
    const person = (await db.query('SELECT id FROM tastenet.users WHERE role=$1 AND is_active LIMIT 1', [role])).rows[0];
    assert.ok(person, `Missing ${role} account`);
    const token = await createSession(db, person.id, config); tokens.push(token);
    const headers = { cookie: `${config.SESSION_COOKIE_NAME}=${token}` };
    const routes = ['/api/auth/me', '/api/auth/profile', '/api/orders', '/api/menu'];
    if (role === 'rider') routes.push('/api/auth/documents');
    if (['admin', 'superadmin'].includes(role)) routes.push('/api/staff/inventory', '/api/staff/menu', '/api/staff/inventory-categories', '/api/manage/riders');
    if (role === 'superadmin') routes.push(...['overview', 'dashboard', 'users', 'recipes', 'transactions', 'settings'].map(route => `/api/manage/${route}`));
    for (const route of routes) {
      const response = await fetch(base + route, { headers });
      assert.equal(response.status, 200, `${role} ${route}`);
      const body = await response.json();
      assert.ok(!body.error, `${role} ${route}`);
      if (route === '/api/manage/users') {
        let photos = 0;
        for (const person of body.items) {
          if (!['customer', 'rider'].includes(person.role) || !person.profile_photo?.startsWith('/api/files/')) continue;
          assert.equal((await fetch(base + person.profile_photo, { headers })).status, 200, 'Superadmin can load account profile photo');
          photos++;
        }
        console.log(`Superadmin profile photos: ${photos} protected images loaded`);
      }
      if(route==='/api/auth/profile' && body.profile.profile_photo?.startsWith('/api/files/')) {
        assert.equal((await fetch(base+body.profile.profile_photo,{headers})).status,200,'Profile media loads');
      }
      if(route==='/api/auth/documents')for(const doc of body.items){
        if(doc.url?.startsWith('/api/files/')) {
          assert.equal((await fetch(base+doc.url,{headers})).status,200,'Private rider document loads');
          assert.equal((await fetch(base+doc.url)).status,401,'Private rider document requires a session');
        }
      }
    }
    console.log(`${role}: ${routes.length} live routes passed`);
  }
  const tables = (await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='tastenet'")).rows[0].n;
  console.log(`PostgreSQL: ${tables} TasteNet tables; live database connection ready`);
} finally {
  for (const token of tokens) await db.query('DELETE FROM tastenet.auth_sessions WHERE token_hash=$1', [createHash('sha256').update(token).digest('hex')]);
  await db.end();
}
