import { test, expect } from '@playwright/test';

// Use synthetic accounts through mocked API responses. No source passwords or
// customer records are embedded in screenshots or test fixtures.
const menu = [{ id: 1, food_name: 'Tapsilog', food_type: 'Silog', description: 'Beef tapa, garlic rice and egg.', price: 120, image_path: 'Images/tapsilog.jpg', status: 'active', ratings: 5 }, { id: 2, food_name: 'Sizzling Sisig', food_type: 'Sizzling Specials', description: 'Freshly cooked pork sisig.', price: 150, image_path: 'Images/Sisig.jpg', status: 'active', ratings: 5 }];
const inventory = [{ id: 1, item_code: 'ING-01', item_name: 'Rice', category_id: 1, category_name: 'Grains & Starches', current_stock: 24, minimum_stock: 5, unit_price: 55, unit_cost: 50, unit_of_measure: 'kg', is_available: true }];
const order = { id: 1, ticket_number: 'TN-SAMPLE', order_number: 'ORD-SAMPLE', order_type: 'Delivery', customer_name: 'Sample Customer', customer_phone: '09123456789', delivery_address: 'Sample Street, Dasmariñas', total_amount: 270, payment_method: 'Cash on Delivery', status: 'In Progress', item_count: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), created_by: 1, rider_id: 3, rider_name: 'Sample Rider' };
async function fixture(page, role) {
  await page.route('https://www.google.com/maps/embed**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Map preview</body></html>' }));
  const user = role ? { id: role === 'rider' ? 3 : 1, username: `sample_${role}`, email: `${role}@example.test`, fullName: `Sample ${role}`, role } : null;
  const profile = user && { ...user, full_name: user.fullName, phone: '09123456789', gender: 'Male', address: 'Sample Street, Dasmariñas', rider_status: 'offline', ratings: 5, created_at: new Date().toISOString() };
  const people = ['customer', 'admin', 'rider', 'superadmin'].map((r, index) => ({ id: index + 1, role: r, full_name: `Sample ${r}`, username: `sample_${r}`, email: `${r}@example.test`, phone: '09123456789', is_active: true, rider_status: 'online', total_orders: 1, total_spent: 270, created_at: new Date().toISOString() }));
  await page.route('**/api/**', async route => {
    const requestUrl = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(requestUrl.hostname)) return route.continue();
    const path = requestUrl.pathname;
    const results = {
      '/api/auth/me': user ? { user } : { error: { message: 'Sign in required' } }, '/api/auth/profile': { profile },
      '/api/menu': { items: menu }, '/api/staff/menu': { items: menu }, '/api/staff/inventory': { items: inventory },
      '/api/staff/inventory-categories': { items: [{ id: 1, category_name: 'Grains & Starches' }] },
      '/api/delivery-fees': { items: [{ id: 1, barangay_name: 'Sample Barangay', fee: 35 }] },
      '/api/payment-methods': { items: [{ id: 1, method_name: 'Cash on Delivery' }] },
      '/api/orders': { items: [order, { ...order, id: 2, ticket_number: 'TN-COMPLETED', status: 'Completed', completed_at: new Date().toISOString() }] }, '/api/orders/1/items': { items: [{ id: 1, food_name: 'Tapsilog', quantity: 2, sub_total: 240 }] },
      '/api/manage/riders': { items: people.filter(p => p.role === 'rider') }, '/api/manage/users': { items: people },
      '/api/manage/overview': { activeUsers: 4, orders: 1, revenue: 270, lowStock: 0 },
      '/api/manage/dashboard': { quotas: [{ id: 1, quota_type: 'Monthly', target_amount: 5000 }], topMeals: [{ food_name: 'Tapsilog', quantity: 2, revenue: 240 }], revenue: [{ date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }), revenue: 270 }] },
      '/api/manage/transactions': { items: [] }, '/api/manage/settings': { paymentMethods: [{ id: 1, method_name: 'Cash on Delivery', status: 'Active', is_enabled: true }] },
      '/api/manage/recipes': { items: [{ id: 1, menu_id: 1, inventory_id: 1, quantity_required: .15, item_name: 'Rice' }] }
    };
    await route.fulfill({ status: path === '/api/auth/me' && !user ? 401 : 200, contentType: 'application/json', body: JSON.stringify(results[path] || { status: 'online' }) });
  });
}
async function verify(page, name) {
  await expect(page.locator('body')).not.toHaveText('');
  await expect(page.locator('.migration-loading')).toHaveCount(0);
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('img')].filter(img => img.getBoundingClientRect().top < window.innerHeight).every(img => img.complete && img.naturalWidth > 0))).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow, `${name} has horizontal page overflow`).toBe(false);
  await page.screenshot({ path: `test-results/design-${name}.png`, animations: 'disabled' });
}

test('original public website and account forms render on desktop and mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message)); await fixture(page, null);
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Sizzling Good Food, Delivered Hot!' })).toBeVisible(); await verify(page, 'landing-desktop');
  await page.goto('/login'); await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible(); await verify(page, 'login-desktop');
  await page.goto('/register'); await expect(page.getByRole('heading', { name: 'Create Customer Account' })).toBeVisible(); await verify(page, 'register-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await verify(page, 'register-mobile');
  await page.goto('/'); await verify(page, 'landing-mobile'); await page.getByRole('button', { name: 'Toggle navigation' }).click(); await expect(page.locator('.mobile-nav-drawer')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const role of ['customer', 'admin', 'rider', 'superadmin']) test(`${role} screens and dialogs render without errors`, async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message)); await fixture(page, role); await page.goto(`/${role}`);
  await verify(page, `${role}-desktop`);
  if (role === 'customer') {
    await page.locator('.add-to-cart-btn-text').first().click(); await page.getByRole('button', { name: 'Shopping cart, 1 items' }).click(); await expect(page.getByRole('dialog', { name: 'Your order' })).toBeVisible();
    await page.getByRole('button', { name: 'Checkout', exact: true }).click(); await expect(page.getByRole('dialog', { name: 'Checkout' })).toBeVisible(); await verify(page, 'checkout-desktop'); await page.getByRole('button', { name: 'Close dialog' }).click();
  } else {
    const navigation = role === 'admin' ? ['Inventory', 'Menu', 'Ticketing', 'Order History'] : role === 'rider' ? ['Dashboard', 'Delivery History', 'Profile'] : ['Dashboard', 'Inventory', 'RecipeManager', 'Menu', 'Ticketing', 'Transactions', 'Reports', 'Customers', 'Delivery', 'Settings'];
    for (const label of navigation) {
      await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
      if (label === 'Order History') {
        await page.getByRole('combobox', { name: 'History status' }).selectOption('Completed');
        await expect(page.locator('.orders-table tbody tr')).toHaveCount(1);
        await page.getByRole('button', { name: 'Reset Filters' }).click();
        await expect(page.locator('.orders-table tbody tr')).toHaveCount(2);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export Report' }).click();
        expect((await download).suggestedFilename()).toBe('TasteNet-order-history.csv');
      }
      if (label === 'Reports') {
        await page.getByRole('combobox', { name: 'Report period' }).selectOption('Daily');
        await expect(page.getByRole('img', { name: /^Revenue chart/ })).toBeVisible();
        await page.getByRole('button', { name: 'Orders', exact: true }).click();
        await expect(page.getByRole('img', { name: /^Orders chart/ })).toBeVisible();
        await page.getByRole('button', { name: 'Revenue', exact: true }).click();
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export Report' }).click();
        expect((await download).suggestedFilename()).toBe('TasteNet-orders.csv');
      }
      await verify(page, `${role}-${label.toLowerCase().replaceAll(' ', '-')}`);
      if (['Reports', 'Order History'].includes(label)) {
        await page.setViewportSize({ width: 390, height: 844 });
        await verify(page, `${role}-${label.toLowerCase().replaceAll(' ', '-')}-mobile`);
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 }); await verify(page, `${role}-mobile`);
  expect(errors).toEqual([]);
});
