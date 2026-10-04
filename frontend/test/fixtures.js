const menu = [
  {
    id: 1,
    food_name: "Tapsilog",
    food_type: "Silog",
    description: "Beef tapa, garlic rice and egg.",
    price: 120,
    image_path: "Images/tapsilog.jpg",
    status: "active",
    ratings: 5,
  },
  {
    id: 2,
    food_name: "Sizzling Sisig",
    food_type: "Sizzling Specials",
    description: "Freshly cooked pork sisig.",
    price: 150,
    image_path: "Images/Sisig.jpg",
    status: "active",
    ratings: 5,
  },
];
const inventory = [
  {
    id: 1,
    item_code: "ING-01",
    item_name: "Rice",
    category_id: 1,
    category_name: "Grains & Starches",
    current_stock: 24,
    minimum_stock: 5,
    unit_price: 55,
    unit_cost: 50,
    unit_of_measure: "kg",
    is_available: true,
  },
];
const order = {
  id: 1,
  ticket_number: "TN-SAMPLE",
  order_number: "ORD-SAMPLE",
  order_type: "Delivery",
  customer_name: "Sample Customer",
  customer_phone: "09123456789",
  delivery_address: "Sample Street, Dasmariñas",
  total_amount: 270,
  payment_method: "Cash on Delivery",
  status: "In Progress",
  item_count: 2,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 1,
  rider_id: 3,
  rider_name: "Sample Rider",
};
async function fixture(page, role) {
  await page.route("https://www.google.com/maps/embed**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Map preview</body></html>",
    }),
  );
  const user = role
    ? {
        id: role === "rider" ? 3 : 1,
        username: `sample_${role}`,
        email: `${role}@example.test`,
        fullName: `Sample ${role}`,
        role,
      }
    : null;
  const profile = user && {
    ...user,
    full_name: user.fullName,
    phone: "09123456789",
    gender: "Male",
    address: "Sample Street, Dasmariñas",
    rider_status: "offline",
    ratings: 5,
    created_at: new Date().toISOString(),
  };
  const people = ["customer", "admin", "rider", "superadmin"].map(
    (r, index) => ({
      id: index + 1,
      role: r,
      full_name: `Sample ${r}`,
      username: `sample_${r}`,
      email: `${r}@example.test`,
      phone: "09123456789",
      is_active: true,
      rider_status: "online",
      total_orders: 1,
      total_spent: 270,
      created_at: new Date().toISOString(),
    }),
  );
  await page.route("**/api/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (!["localhost", "127.0.0.1"].includes(requestUrl.hostname))
      return route.continue();
    const path = requestUrl.pathname;
    const results = {
      "/api/auth/capabilities": {
        google: false,
        email: false,
        registrationOtp: false,
      },
      "/api/auth/documents": { items: [] },
      "/api/auth/me": user
        ? { user }
        : { error: { message: "Sign in required" } },
      "/api/auth/profile": { profile },
      "/api/menu": { items: menu },
      "/api/staff/menu": { items: menu },
      "/api/staff/inventory": { items: inventory },
      "/api/staff/inventory-categories": {
        items: [{ id: 1, category_name: "Grains & Starches" }],
      },
      "/api/delivery-fees": {
        items: [{ id: 1, barangay_name: "Sample Barangay", fee: 35 }],
      },
      "/api/payment-methods": {
        items: [{ id: 1, method_name: "Cash on Delivery" }],
      },
      "/api/orders": {
        items: [
          order,
          {
            ...order,
            id: 2,
            ticket_number: "TN-COMPLETED",
            status: "Completed",
            completed_at: new Date().toISOString(),
          },
        ],
      },
      "/api/orders/1/items": {
        items: [{ id: 1, food_name: "Tapsilog", quantity: 2, sub_total: 240 }],
      },
      "/api/manage/riders": { items: people.filter((p) => p.role === "rider") },
      "/api/manage/users": { items: people },
      "/api/manage/overview": {
        activeUsers: 4,
        orders: 1,
        revenue: 270,
        lowStock: 0,
      },
      "/api/manage/dashboard": {
        quotas: [{ id: 1, quota_type: "Monthly", target_amount: 5000 }],
        topMeals: [{ food_name: "Tapsilog", quantity: 2, revenue: 240 }],
        revenue: [
          {
            date: new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Manila",
            }),
            revenue: 270,
          },
        ],
      },
      "/api/manage/transactions": { items: [] },
      "/api/manage/settings": {
        paymentMethods: [
          {
            id: 1,
            method_name: "Cash on Delivery",
            status: "Active",
            is_enabled: true,
          },
        ],
      },
      "/api/manage/recipes": {
        items: [
          {
            id: 1,
            menu_id: 1,
            inventory_id: 1,
            quantity_required: 0.15,
            item_name: "Rice",
          },
        ],
      },
    };
    await route.fulfill({
      status: path === "/api/auth/me" && !user ? 401 : 200,
      contentType: "application/json",
      body: JSON.stringify(results[path] || { status: "online" }),
    });
  });
}

export { fixture, menu, inventory, order };
