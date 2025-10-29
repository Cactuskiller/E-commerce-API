const express = require("express");
const pool = require("../../../db");

const router = express.Router();

router.get("/:orderId/products", async (req, res) => {
  const { orderId } = req.params;

  try {
    // Fetch order and user info
    const orderResult = await pool.query(
      `SELECT 
    o.*, 
    u.name AS user_name
FROM public.orders o
 LEFT JOIN "User" u ON o.user_id = u.id
WHERE o.id = $1;
`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    let items = orderResult.rows[0].items;
    if (typeof items === "string") {
      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.json({ success: true, orderId, products: [] });
    }

    // Collect product IDs
    const productIds = [
      ...new Set(
        items.map((i) => Number(i.product_id || i.id)).filter(Boolean)
      ),
    ];

    if (productIds.length === 0) {
      return res.json({ success: true, orderId, products: [] });
    }

    // Fetch products from DB
    const productsResult = await pool.query(
      `
      SELECT
       *
      FROM public.product p
      WHERE p.id = ANY($1::int[])
      `,
      [productIds]
    );

    // Merge order items with product details
    const merged = items.map((item) => {
      const product = productsResult.rows.find(
        (p) => p.id === Number(item.product_id || item.id)
      );

      return {
        ...item,
        id: Number(item.product_id || item.id),
        name: product?.name ?? item.name,
        price: product?.price ?? item.price,
        stock: product?.stock ?? item.stock,
        primary_image: product?.primary_image ?? item.primary_image,
      };
    });

    // Deduplicate by product + option
    const unique = [];
    const seen = new Set();
    for (const m of merged) {
      const key = `${m.id}_${m.selectedOption || ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(m);
      }
    }

    res.json({
      success: true,
      products: productsResult.rows,
      order: orderResult.rows[0],
    });
  } catch (err) {
    console.error("❌ Error fetching order products:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all orders with user information
router.get("/", async (req, res) => {
  console.log("Fetching all orders with user information...");

  try {
    const result = await pool.query(
      `SELECT
        o.*,
        u.name as user_name,
        u.email as user_email,
        u.user_name as username,
        u.phone as user_phone
       FROM "orders" o
       LEFT JOIN "User" u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );

    console.log(`✅ Found ${result.rows.length} orders`);

    res.json(result.rows);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get single order by ID with user information
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        o.*,
        u.name as user_name,
        u.email as user_email,
        u.user_name as username,
        u.phone as user_phone
       FROM "orders" o 
       LEFT JOIN "User" u ON o.user_id = u.id 
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Get orders by user ID with user information
router.get("/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    console.log(`🔍 Fetching orders for user_id: ${userId}`);

    const result = await pool.query(
      `SELECT 
        o.*, 
        u.name AS user_name,
        u.email AS user_email,
        u.user_name AS username,
        u.phone AS user_phone,
        u.avatar
      FROM "orders" o
      LEFT JOIN "User" u ON o.user_id = u.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC`,
      [userId]
    );

    console.log(`✅ Found ${result.rows.length} orders for user ${userId}`);
    res.json(result.rows);
  } catch (err) {
    console.error("💥 Database error in /user/:userId:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Update order status (with user info in response)
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const validStatuses = [
      "Created",
      "Accepted",
      "Preparing",
      "Shipping",
      "Delivered",
      "Canceled", // Fixed spelling to match database
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status value: ${status}. Valid statuses: ${validStatuses.join(
          ", "
        )}`,
      });
    }

    console.log(`Updating order ${id} status to: ${status}`);

    // Update the order status
    const updateResult = await pool.query(
      `UPDATE "orders" SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get the updated order with user info
    const orderWithUser = await pool.query(
      `SELECT 
        o.*,
        u.name as user_name,
        u.email as user_email,
        u.user_name as username,
        u.phone as user_phone
       FROM "orders" o 
       LEFT JOIN "User" u ON o.user_id = u.id 
       WHERE o.id = $1`,
      [id]
    );

    console.log(`✅ Order ${id} successfully updated to ${status}`);

    res.json({
      success: true,
      message: "Order status updated successfully",
      order: orderWithUser.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// Create a new order
router.post("/", async (req, res) => {
  const {
    user_id,
    items,
    phone,
    address,
    status,
    created_at,
    active,
    voucher_info,
    delivery_cost,
    voucher_id,
  } = req.body;

  try {
    console.log("Request body:", req.body);

    const itemsJson = typeof items === "object" ? JSON.stringify(items) : items;
    const voucherInfoJson =
      typeof voucher_info === "object"
        ? JSON.stringify(voucher_info)
        : voucher_info;

    const result = await pool.query(
      `INSERT INTO "orders"
        (user_id, items, phone, address, status, created_at, active, voucher_info, delivery_cost, voucher_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user_id,
        itemsJson,
        phone,
        address,
        status,
        created_at,
        active,
        voucherInfoJson,
        delivery_cost,
        voucher_id,
      ]
    );

    // Get the created order with user info
    const orderWithUser = await pool.query(
      `SELECT 
    o.*,
    u.name AS user_name,
    u.email AS user_email,
    u.user_name AS username,
    u.phone AS user_phone
FROM "orders" o
LEFT JOIN "User" u ON o.user_id = u.id
WHERE o.id = $1;
`,
      [result.rows[0].id]
    );

    console.log(`✅ Order created with ID: ${result.rows[0].id}`);

    res.status(201).json({
      success: true,
      order: orderWithUser.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


//new put point with stock sync :

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    user_id,
    items,
    phone,
    address,
    status,
    active,
    voucher_info,
    delivery_cost,
    voucher_id,
  } = req.body;

  try {
    console.log("🛠 Updating order with ID:", id);

    // ✅ Parse new items safely
    let parsedItems;
    if (typeof items === "string") {
      try {
        parsedItems = JSON.parse(items);
      } catch {
        throw new Error("Invalid JSON in 'items'");
      }
    } else {
      parsedItems = items;
    }

    // ✅ Fetch current order
    const oldOrderRes = await pool.query(`SELECT items FROM orders WHERE id = $1`, [id]);
    let oldItems = [];
    if (oldOrderRes.rows.length) {
      const rawItems = oldOrderRes.rows[0].items;
      if (typeof rawItems === "string") {
        try {
          oldItems = JSON.parse(rawItems);
        } catch {
          console.warn("⚠️ oldItems already an object, using as is");
          oldItems = rawItems;
        }
      } else {
        oldItems = rawItems;
      }
    }

    // ✅ Build oldQtyMap
    const oldQtyMap = {};
    for (const it of oldItems || []) {
      const pid = it.product_id || it.id;
      if (pid) oldQtyMap[pid] = Number(it.qty || it.quantity || 0);
    }

    // ✅ Begin transaction (for atomic safety)
    await pool.query("BEGIN");

    // ✅ Validate & adjust stock
    for (const it of parsedItems) {
      const pid = it.product_id || it.id;
      const requestedQty = Number(it.qty || it.quantity || 0);
      const oldQty = oldQtyMap[pid] || 0;

      const stockRes = await pool.query(`SELECT stock, name FROM product WHERE id = $1 FOR UPDATE`, [pid]);
      if (!stockRes.rows.length) continue;

      const { stock, name } = stockRes.rows[0];
      const availableTotal = stock + oldQty;

      if (requestedQty > availableTotal) {
        await pool.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: `❌ Not enough stock for ${name}. Available: ${stock}, requested increase: ${requestedQty - oldQty}`,
        });
      }

      const diff = requestedQty - oldQty; // + means reduce stock, - means add back
      if (diff !== 0) {
        await pool.query(`UPDATE product SET stock = stock - $1 WHERE id = $2`, [diff, pid]);
        console.log(`📦 Product ${pid}: adjusted stock by ${-diff} (newQty=${requestedQty}, oldQty=${oldQty})`);
      }
    }

    // ✅ Update order
    await pool.query(
      `UPDATE orders
       SET user_id=$1, items=$2, phone=$3, address=$4, status=$5, active=$6,
           voucher_info=$7, delivery_cost=$8, voucher_id=$9
       WHERE id=$10`,
      [
        user_id,
        JSON.stringify(parsedItems),
        phone,
        address,
        status,
        active,
        voucher_info,
        delivery_cost,
        voucher_id,
        id,
      ]
    );

    // ✅ Commit transaction
    await pool.query("COMMIT");

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Update Order Error:", error);
    try {
      await pool.query("ROLLBACK");
    } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});




// Delete an order
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("Deleting order with ID:", id);

    // Get order with user info before deleting
    const orderWithUser = await pool.query(
      `SELECT 
    o.*,
    u.name AS user_name,
    u.email AS user_email,
    u.user_name AS username,
    u.phone AS user_phone
FROM "orders" o
LEFT JOIN "User" u ON o.user_id = u.id
WHERE o.id = $1;
`,
      [id]
    );

    if (orderWithUser.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Delete the order
    await pool.query(`DELETE FROM "orders" WHERE id = $1`, [id]);

    res.json({
      success: true,
      message: "Order deleted successfully",
      order: orderWithUser.rows[0],
    });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
