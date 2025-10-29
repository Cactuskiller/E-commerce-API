const express = require("express");
const pool = require("../../../db");

const router = express.Router();

//geting product with pagination
router.get("/", async (req, res) => {
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
  const offset = (page - 1) * limit;

  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM product');
    const total = Number(countRes.rows[0].count);
    const result = await pool.query(
      `
      SELECT
        p.*,
        (
          SELECT link
          FROM images
          WHERE images.product_id = p.id AND images.priority = 1
          ORDER BY id ASC
          LIMIT 1
        ) AS image
      FROM product p
      ORDER BY p.id ASC
      LIMIT $1 OFFSET $2;
      `,
      [limit, offset]
    );
    res.json({
      products: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching paginated products:", err);
    res.status(500).json({ error: err.message });
  }
});


// Get single product by ID with all it images
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch product
    const productRes = await pool.query(
      'SELECT * FROM "product" WHERE id = $1',
      [id]
    );
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productRes.rows[0];

    // Fetch images for this product
    const imagesRes = await pool.query(
      "SELECT link FROM images WHERE product_id = $1 ORDER BY priority ASC, id ASC",
      [id]
    );
    const images = imagesRes.rows.map((row) => row.link);

    // Attach images array to product
    product.images = images;

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List products with a single primary_image
// router.get("/with-primary-image", async (req, res) => {
//   let query = `
//     SELECT p.*,
//            i.link AS primary_image,
//            r.avg_rating,
//            r.rating_count
//     FROM "product" p
//     LEFT JOIN LATERAL (
//       SELECT link
//       FROM images i
//       WHERE i.product_id = p.id
//       ORDER BY i.priority ASC NULLS LAST, i.id ASC
//       LIMIT 1
//     ) i ON true
//     LEFT JOIN LATERAL (
//       SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating,
//              COUNT(*) AS rating_count
//       FROM rating r
//       WHERE r.product_id = p.id
//     ) r ON true
//   `;
//   let values = [];
//   if (req.query.category_id) {
//     query += " WHERE p.category_id = $1";
//     values.push(req.query.category_id);
//   }
//   query += " ORDER BY p.id DESC";

//   try {
//     const result = await pool.query(query, values);
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

router.get("/withPrimaryImageAndRating", async (req, res) => {
  const { category_id, search } = req.query;

  try {
    let query = `
      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object(
            'id', i.id,
            'link', i.link,
            'priority', i.priority
          ) ORDER BY i.priority ASC NULLS LAST, i.id ASC)
          FROM public.images i
          WHERE i.product_id = p.id
        ) AS images,
        (
          SELECT ROUND(AVG(r.value)::numeric, 1)
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS avg_rating,
        (
          SELECT COUNT(*)
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS rating_count
      FROM public.product p
      WHERE p.active = true
    `;

    const values = [];
    let index = 1;

    if (category_id) {
      query += ` AND p.category_id = $${index++}`;
      values.push(category_id);
    }

    if (search) {
      query += ` AND p.name ILIKE $${index++}`;
      values.push(`%${search}%`);
    }

    query += ` ORDER BY p.id DESC`;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error in /withPrimaryImageAndRating:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Single product with primary_image
// In your products router
router.get("/:id/with-primary-image", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `      SELECT 
        p.*,
        (
          SELECT json_agg(json_build_object(
            'id', i.id,
            'link', i.link,
            'priority', i.priority
          ) ORDER BY i.priority ASC NULLS LAST, i.id ASC)
          FROM public.images i
          WHERE i.product_id = p.id
        ) AS images,
        (
          SELECT ROUND(AVG(r.value)::numeric, 1)
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS avg_rating,
        (
          SELECT COUNT(*)
          FROM public.rating r
          WHERE r.product_id = p.id
        ) AS rating_count
      FROM public.product p
      WHERE p.active = true AND p.id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ message: "Product not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id/related", async (req, res) => {
  const { id } = req.params;
  try {
    const productResult = await pool.query(
      `SELECT p.*,
              i.link AS primary_image,
              r.avg_rating,
              r.rating_count
       FROM "product" p
       LEFT JOIN LATERAL (
         SELECT link
         FROM images i
         WHERE i.product_id = p.id
         ORDER BY i.priority ASC NULLS LAST, i.id ASC
         LIMIT 1
       ) i ON true
       LEFT JOIN LATERAL (
         SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating,
                COUNT(*) AS rating_count
         FROM rating r
         WHERE r.product_id = p.id
       ) r ON true
       WHERE p.id = $1`,
      [id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productResult.rows[0];

    let relatedProducts = [];
    if (product.related && product.related.length > 0) {
      const relatedResult = await pool.query(
        `SELECT p.*,
                i.link AS primary_image,
                r.avg_rating,
                r.rating_count
         FROM "product" p
         LEFT JOIN LATERAL (
           SELECT link
           FROM images i
           WHERE i.product_id = p.id
           ORDER BY i.priority ASC NULLS LAST, i.id ASC
           LIMIT 1
         ) i ON true
         LEFT JOIN LATERAL (
           SELECT ROUND(AVG(r.value)::numeric, 1) AS avg_rating,
                  COUNT(*) AS rating_count
           FROM rating r
           WHERE r.product_id = p.id
         ) r ON true
         WHERE p.id = ANY($1::int[])`,
        [product.related]
      );
      relatedProducts = relatedResult.rows;
    }

    // Step 3: Respond with product + its related products
    res.json(relatedProducts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new product
router.post("/", async (req, res) => {
  const {
    name,
    category_id,
    related,
    description,
    active,
    created_at,
    options,
    price,
    endprice,
    endpricdate,
    stock,
    available,
    created_at_product,
  } = req.body;

  try {
    // Convert options and related to JSON string if they are objects
    const optionsJson =
      typeof options === "object" ? JSON.stringify(options) : options;
    const relatedJson =
      typeof related === "object" ? JSON.stringify(related) : related;

    // Log the processed values
    console.log("Processed optionsJson:", optionsJson);
    console.log("Processed relatedJson:", relatedJson);

    const result = await pool.query(
      `INSERT INTO "product"
				(name, category_id, related, description, active, created_at, options, price, endprice, endpricdate, stock, available, created_at_product)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
			 RETURNING *`,
      [
        name,
        category_id,
        relatedJson,
        description,
        active,
        created_at,
        optionsJson,
        price,
        endprice,
        endpricdate,
        stock,
        available,
        created_at_product,
      ]
    );
    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a product
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    category_id,
    related,
    description,
    active,
    options,
    price,
    endprice,
    endpricdate,
    stock,
    available,
  } = req.body;

  try {
    // Convert options and related to JSON string if they are objects
    const optionsJson =
      typeof options === "object" ? JSON.stringify(options) : options;
    const relatedJson =
      typeof related === "object" ? JSON.stringify(related) : related;

    console.log("Updating product with ID:", id);
    console.log("Processed optionsJson:", optionsJson);
    console.log("Processed relatedJson:", relatedJson);

    const result = await pool.query(
      `UPDATE "product" SET 
				name = $1, 
				category_id = $2, 
				related = $3, 
				description = $4, 
				active = $5, 
				options = $6, 
				price = $7, 
				endprice = $8, 
				endpricdate = $9, 
				stock = $10, 
				available = $11
			WHERE id = $12 
			RETURNING *`,
      [
        name,
        category_id,
        relatedJson,
        description,
        active,
        optionsJson,
        price,
        endprice,
        endpricdate,
        stock,
        available,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a product
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("Deleting product with ID:", id);

    // Step 1: Delete related ratings first
    await pool.query(`DELETE FROM "rating" WHERE product_id = $1`, [id]);

    // Step 2: Delete related images
    await pool.query(`DELETE FROM "images" WHERE product_id = $1`, [id]);

    // Step 3: Then delete the product itself
    const result = await pool.query(
      `DELETE FROM "product" WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product, related ratings, and images deleted successfully",
      product: result.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});
// Get single product by ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch product
    const productRes = await pool.query(
      'SELECT * FROM "product" WHERE id = $1',
      [id]
    );
    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const product = productRes.rows[0];

    // Fetch images for this product
    const imagesRes = await pool.query(
      "SELECT link FROM images WHERE product_id = $1 ORDER BY priority ASC, id ASC",
      [id]
    );
    const images = imagesRes.rows.map((row) => row.link);

    // Attach images array to product
    product.images = images;

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
