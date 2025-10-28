const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all orders
router.get('/', async (req, res) => {
	try {
		const result = await pool.query('SELECT * FROM "orders"');
		res.json(result.rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Create a new order
// router.post('/', async (req, res) => {
// 	const {
// 		user_id,
// 		items,
// 		phone,
// 		address,
// 		status,
// 		created_at,
// 		active,
// 		voucher_info,
// 		delivery_cost,
// 		voucher_id
// 	} = req.body;

// 	try {
// 		console.log('Request body:', req.body);
// 		console.log('Received status value:', status);
		
// 		// Convert items and voucher_info to JSON string if they are objects
// 		const itemsJson = typeof items === 'object' ? JSON.stringify(items) : items;
// 		const voucherInfoJson = typeof voucher_info === 'object' ? JSON.stringify(voucher_info) : voucher_info;
		
// 		console.log('Processed itemsJson:', itemsJson);
// 		console.log('Processed voucherInfoJson:', voucherInfoJson);

// 		const result = await pool.query(
// 			`INSERT INTO "orders"
// 				(user_id, items, phone, address, status, created_at, active, voucher_info, delivery_cost, voucher_id)
// 			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
// 			 RETURNING *`,
// 			[user_id, itemsJson, phone, address, status, created_at, active, voucherInfoJson, delivery_cost, voucher_id]
// 		);
// 		res.status(201).json({ success: true, order: result.rows[0] });
// 	} catch (err) {
// 		res.status(500).json({ success: false, error: err.message });
// 	}
// });


// Create a new order
// Create a new order
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
    console.log("🧾 Creating new order for user:", user_id);

    // ✅ Parse items safely
    const parsedItems =
      typeof items === "string" ? JSON.parse(items) : items || [];

    const itemsJson = JSON.stringify(parsedItems);
    const voucherInfoJson =
      typeof voucher_info === "object"
        ? JSON.stringify(voucher_info)
        : voucher_info;

    // ✅ Insert new order
    const result = await pool.query(
      `INSERT INTO "orders"
         (user_id, items, phone, address, status, created_at, active, voucher_info, delivery_cost, voucher_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        user_id,
        itemsJson,
        phone,
        address,
        status || "Created",
        created_at || new Date(),
        active ?? true,
        voucherInfoJson,
        delivery_cost || 0,
        voucher_id || null,
      ]
    );

    let newOrder = result.rows[0];

    // ✅ Enrich items with product details (using only `product` + `images`)
    const detailedItems = await Promise.all(
      parsedItems.map(async (it) => {
        const pid = it.product_id || it.id;
        const qty = it.quantity || it.qty || 1;

        const { rows } = await pool.query(
          `
          SELECT 
            p.id,
            p.name,
            p.price,
            p.endprice,
            img.link AS image
          FROM product p
          LEFT JOIN LATERAL (
            SELECT link 
            FROM images i 
            WHERE i.product_id = p.id 
            ORDER BY i.priority ASC NULLS LAST, i.id ASC 
            LIMIT 1
          ) img ON TRUE
          WHERE p.id = $1
          `,
          [pid]
        );

        if (rows.length === 0) {
          // Product not found, fallback
          return { product_id: pid, quantity: qty };
        }

        const product = rows[0];
        return {
          id: product.id,
          product_id: product.id,
          name: product.name,
          price: Number(product.endprice || product.price || 0),
          qty,
          quantity: qty,
          image: product.image || null,
        };
      })
    );

    newOrder.items = detailedItems;

    res.status(201).json({ success: true, order: newOrder });
  } catch (err) {
    console.error("❌ Create Order Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// Update an order
router.put('/:id', async (req, res) => {
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
		voucher_id
	} = req.body;

	try {
		console.log('Updating order with ID:', id);
		console.log('Received status value:', status);
		
		// Convert items and voucher_info to JSON string if they are objects
		const itemsJson = typeof items === 'object' ? JSON.stringify(items) : items;
		const voucherInfoJson = typeof voucher_info === 'object' ? JSON.stringify(voucher_info) : voucher_info;
		
		console.log('Processed itemsJson:', itemsJson);
		console.log('Processed voucherInfoJson:', voucherInfoJson);
		
		const result = await pool.query(
			`UPDATE "orders" SET 
				user_id = $1, 
				items = $2, 
				phone = $3, 
				address = $4, 
				status = $5, 
				active = $6, 
				voucher_info = $7, 
				delivery_cost = $8, 
				voucher_id = $9
			WHERE id = $10 
			RETURNING *`,
			[user_id, itemsJson, phone, address, status, active, voucherInfoJson, delivery_cost, voucher_id, id]
		);
		
		if (result.rows.length === 0) {
			return res.status(404).json({ success: false, message: 'Order not found' });
		}
		
		res.json({ success: true, order: result.rows[0] });
	} catch (err) {
		console.log('Database error:', err.message);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Delete an order
router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	
	try {
		console.log('Deleting order with ID:', id);
		
		const result = await pool.query(
			`DELETE FROM "orders" WHERE id = $1 RETURNING *`,
			[id]
		);
		
		if (result.rows.length === 0) {
			return res.status(404).json({ success: false, message: 'Order not found' });
		}
		
		res.json({ success: true, message: 'Order deleted successfully', order: result.rows[0] });
	} catch (err) {
		console.log('Database error:', err.message);
		res.status(500).json({ success: false, error: err.message });
	}
});

module.exports = router;