import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createApp } from '../src/app.js';
import { authorize, createSession } from '../src/auth.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = {
  NODE_ENV: 'test', CLIENT_ORIGIN: 'http://localhost:5173',
  SESSION_DAYS: 7, SESSION_COOKIE_NAME: 'tastenet_session'
};

test('schema, synthetic seed, and auth HTTP flow', async () => {
  const db = new PGlite();
  const schema = await readFile(path.resolve(here, '../../database/schema.sql'), 'utf8');
  const seed = await readFile(path.resolve(here, '../../database/seed.sql'), 'utf8');
  await db.exec(schema);
  await db.exec(seed);
  await db.exec(seed);
  db.connect = async () => ({ query: (...args) => db.query(...args), release: () => {} });
  const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'tastenet'");
  assert.equal(tables.rows.length, 23);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tastenet.users')).rows[0].n, 0);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tastenet.menu')).rows[0].n, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM tastenet.delivery_fees')).rows[0].n, 2);

  const server = createApp({ db, config }).listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options = {}) => fetch(base + url, {
    ...options,
    headers: { 'content-type': 'application/json', origin: config.CLIENT_ORIGIN, ...options.headers }
  });
  try {
    assert.equal((await request('/health/live')).status, 200);
    assert.equal((await request('/health/ready')).status, 200);
    assert.equal((await request('/api/auth/me')).status, 401);

    const bad = await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: 'x' }) });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error.code, 'VALIDATION_ERROR');

    const registration = {
      username: 'sample_customer', email: 'sample@example.test',
      password: 'a-long-sample-password', fullName: 'Sample Customer'
    };
    const register = await request('/api/auth/register', { method: 'POST',
      body: JSON.stringify({ ...registration, role: 'superadmin' }) });
    assert.equal(register.status, 400);
    const created = await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration) });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).user.role, 'customer');
    assert.equal((await db.query('SELECT password_hash FROM tastenet.users')).rows[0].password_hash.startsWith('$2'), true);
    assert.equal((await request('/api/auth/register', { method: 'POST', body: JSON.stringify(registration) })).status, 409);

    const wrong = await request('/api/auth/login', { method: 'POST',
      body: JSON.stringify({ identifier: registration.email, password: 'wrong' }) });
    assert.equal(wrong.status, 401);
    const login = await request('/api/auth/login', { method: 'POST',
      body: JSON.stringify({ identifier: registration.email, password: registration.password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const me = await request('/api/auth/me', { headers: { cookie } });
    assert.equal((await me.json()).user.username, registration.username);

    const product = (await db.query('SELECT id FROM tastenet.menu LIMIT 1')).rows[0];
    const orderResponse = await request('/api/orders', { method: 'POST', headers: { cookie },
      body: JSON.stringify({ items: [{ menuId: product.id, quantity: 2 }],
        deliveryAddress: '123 Sample Street', barangayName: 'Sample Barangay A',
        paymentMethod: 'Cash on Delivery' }) });
    assert.equal(orderResponse.status, 201);
    const order = (await orderResponse.json()).order;
    assert.equal(Number(order.total_amount), 333);
    assert.equal((await request('/api/staff/menu', { headers: { cookie } })).status, 403);
    assert.equal((await request('/api/orders', { headers: { cookie } })).status, 200);

    async function roleCookie(role) {
      const user = await db.query(`INSERT INTO tastenet.users
        (username, email, password_hash, full_name, role)
        VALUES ($1,$2,'placeholder',$3,$4) RETURNING id`,
      [`sample_${role}`, `${role}@example.test`, `Sample ${role}`, role]);
      const token = await createSession(db, user.rows[0].id, config);
      return { cookie: `${config.SESSION_COOKIE_NAME}=${token}`, id: user.rows[0].id };
    }
    const admin = await roleCookie('admin');
    const rider = await roleCookie('rider');
    const superadmin = await roleCookie('superadmin');
    for (const endpoint of ['dashboard', 'recipes', 'transactions', 'settings', 'users']) {
      assert.equal((await request(`/api/manage/${endpoint}`, { headers: { cookie: superadmin.cookie } })).status, 200, endpoint);
      assert.equal((await request(`/api/manage/${endpoint}`, { headers: { cookie: rider.cookie } })).status, 403, `${endpoint} rider protection`);
    }
    const profile = await (await request('/api/auth/profile', { headers: { cookie } })).json();
    assert.equal(profile.profile.full_name, registration.fullName);
    assert.equal('password_hash' in profile.profile, false);
    const updateProfile = await request('/api/auth/profile', { method: 'PATCH', headers: { cookie },
      body: JSON.stringify({ fullName: 'Updated Sample Customer', phone: '09123456789', gender: 'Female', address: '123 Sample Street' }) });
    assert.equal(updateProfile.status, 200);
    assert.equal((await updateProfile.json()).profile.address, '123 Sample Street');
    assert.equal((await request('/api/auth/availability', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ status: 'online' }) })).status, 403);
    assert.equal((await request('/api/auth/availability', { method: 'PATCH', headers: { cookie: rider.cookie }, body: JSON.stringify({ status: 'online' }) })).status, 200);
    assert.equal((await db.query('SELECT rider_status FROM tastenet.users WHERE id=$1', [rider.id])).rows[0].rider_status, 'online');
    const staffOrder = { items: [{ menuId: product.id, quantity: 1 }], deliveryAddress: '', barangayName: '', paymentMethod: 'Cash on Delivery', orderType: 'Dine-In' };
    assert.equal((await request('/api/orders', { method: 'POST', headers: { cookie }, body: JSON.stringify(staffOrder) })).status, 403);
    const dineIn = await request('/api/orders', { method: 'POST', headers: { cookie: admin.cookie }, body: JSON.stringify(staffOrder) });
    assert.equal(dineIn.status, 201);
    assert.equal(Number((await dineIn.json()).order.total_amount), 149);
    const ingredient = (await db.query('SELECT id, current_stock FROM tastenet.inventory LIMIT 1')).rows[0];
    const restock = { items: [{ id: ingredient.id, quantity: 2.5 }] };
    assert.equal((await request('/api/staff/restock', { method: 'POST', headers: { cookie }, body: JSON.stringify(restock) })).status, 403);
    assert.equal((await request('/api/staff/restock', { method: 'POST', headers: { cookie: admin.cookie }, body: JSON.stringify(restock) })).status, 200);
    assert.equal(Number((await db.query('SELECT current_stock FROM tastenet.inventory WHERE id=$1', [ingredient.id])).rows[0].current_stock), Number(ingredient.current_stock) + 2.5);
    assert.equal((await request('/api/staff/restock', { method: 'POST', headers: { cookie: admin.cookie }, body: JSON.stringify({ items: [...restock.items, { id: 999999, quantity: 1 }] }) })).status, 404);
    assert.equal(Number((await db.query('SELECT current_stock FROM tastenet.inventory WHERE id=$1', [ingredient.id])).rows[0].current_stock), Number(ingredient.current_stock) + 2.5, 'Restock rolls back all updates on failure');
    const recipeBody = JSON.stringify({ ingredients: [{ inventoryId: ingredient.id, quantity: .25 }] });
    assert.equal((await request(`/api/manage/recipes/${product.id}`, { method: 'PUT', headers: { cookie: admin.cookie }, body: recipeBody })).status, 403);
    assert.equal((await request(`/api/manage/recipes/${product.id}`, { method: 'PUT', headers: { cookie: superadmin.cookie }, body: recipeBody })).status, 200);
    const paymentId = (await db.query('SELECT id FROM tastenet.payment_methods LIMIT 1')).rows[0].id;
    assert.equal((await request(`/api/manage/payment-methods/${paymentId}`, { method: 'PATCH', headers: { cookie: superadmin.cookie }, body: JSON.stringify({ isEnabled: true, instructions: 'Sample payment instructions', accountDetails: '' }) })).status, 200);
    const quotaId = (await db.query("INSERT INTO tastenet.quotas (quota_type,target_amount,start_date,end_date) VALUES ('Monthly',1000,'2026-10-01','2026-10-31') RETURNING id")).rows[0].id;
    assert.equal((await request(`/api/manage/quotas/${quotaId}`, { method: 'PATCH', headers: { cookie: superadmin.cookie }, body: JSON.stringify({ targetAmount: 2000 }) })).status, 200);
    assert.equal((await request('/api/manage/users', { headers: { cookie: admin.cookie } })).status, 403);
    assert.equal((await request('/api/manage/overview', { headers: { cookie: superadmin.cookie } })).status, 200);
    const assign = await request(`/api/orders/${order.id}/assign`, { method: 'PATCH',
      headers: { cookie: admin.cookie }, body: JSON.stringify({ riderId: rider.id }) });
    assert.equal(assign.status, 200);
    const start = await request(`/api/orders/${order.id}/status`, { method: 'PATCH',
      headers: { cookie: admin.cookie }, body: JSON.stringify({ status: 'In Progress' }) });
    assert.equal(start.status, 200);
    const finish = await request(`/api/orders/${order.id}/status`, { method: 'PATCH',
      headers: { cookie: rider.cookie }, body: JSON.stringify({ status: 'Completed' }) });
    assert.equal(finish.status, 200);

    const extraLogin = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: registration.username, password: registration.password }) });
    const extraCookie = extraLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await request('/api/auth/password', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ currentPassword: 'wrong', newPassword: 'another-long-sample-password' }) })).status, 400);
    assert.equal((await request('/api/auth/password', { method: 'PATCH', headers: { cookie }, body: JSON.stringify({ currentPassword: registration.password, newPassword: 'another-long-sample-password' }) })).status, 200);
    assert.equal((await request('/api/auth/me', { headers: { cookie: extraCookie } })).status, 401, 'Other sessions revoked after password change');
    assert.equal((await request('/api/auth/me', { headers: { cookie } })).status, 200);
    const logout = await request('/api/auth/logout', { method: 'POST', headers: { cookie } });
    assert.equal(logout.status, 204);
    assert.equal((await request('/api/auth/me', { headers: { cookie } })).status, 401);
    assert.equal((await request('/missing')).status, 404);
    assert.equal((await request('/api/auth/login', { method: 'POST', body: '{broken' })).status, 400);
    assert.equal((await request('/api/auth/login', { method: 'POST',
      headers: { origin: 'https://evil.example' }, body: '{}' })).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});

test('role middleware denies insufficient permissions', () => {
  let result;
  authorize('admin', 'superadmin')({ user: { role: 'customer' } }, {}, error => { result = error; });
  assert.equal(result.status, 403);
  authorize('admin', 'superadmin')({ user: { role: 'admin' } }, {}, error => { result = error; });
  assert.equal(result, undefined);
});
