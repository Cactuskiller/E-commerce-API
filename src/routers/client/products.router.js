const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all products
router.get("/", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "product"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List products with a single primary_image
router.get("/with-primary-image", async (req, res) => {
  let query = `
    SELECT p.*,
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
  `;
  let values = [];
  if (req.query.category_id) {
    query += " WHERE p.category_id = $1";
    values.push(req.query.category_id);
  }
  query += " ORDER BY p.id DESC";

  try {
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Single product with primary_image
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
    // Step 1: Fetch the product (with its related IDs column)
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

    // Step 2: Fetch products by the IDs in `related`
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

    const result = await pool.query(
      `DELETE FROM "product" WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    res.json({
      success: true,
      message: "Product deleted successfully",
      product: result.rows[0],
    });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
