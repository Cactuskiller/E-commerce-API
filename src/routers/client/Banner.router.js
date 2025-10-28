const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all banners
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
    b.id,
    b.name,
    b.type,
    b.priority,
    b.background,
    b.active,
    b.hidden,
    b.created_at,
    json_agg(
        CASE
            -- If element is a number and banner type is list, fetch product
            WHEN jsonb_typeof(elem) = 'number' AND b.type = 'List' THEN
                (
                    SELECT json_agg(
                        json_build_object(
                            'id', p.id,
                            'name', p.name,
                            'description', p.description,
                            'price', p.price,
                            'endprice', p.endprice,
                            'primary_image', img.link,
                            'avg_rating', COALESCE(r.avg_rating,0),
                            'rating_count', COALESCE(r.rating_count,0)
                        )::jsonb
                    )
                    FROM product p
                    LEFT JOIN LATERAL (
                        SELECT link
                        FROM images i
                        WHERE i.product_id = p.id
                        ORDER BY i.priority ASC NULLS LAST, i.id ASC
                        LIMIT 1
                    ) img ON true
                    LEFT JOIN LATERAL (
                        SELECT AVG(value)::numeric(10,2) AS avg_rating,
                               COUNT(*) AS rating_count
                        FROM rating r
                        WHERE r.product_id = p.id
                    ) r ON true
                    WHERE p.id = elem::int
                )::jsonb

            -- If element is a number and banner type is category, fetch category
            WHEN jsonb_typeof(elem) = 'number' AND b.type = 'Category' THEN
                (
                    SELECT json_build_object(
                        'id', c.id,
                        'name', c.name,
                        'image', c.image
                    )::jsonb
                    FROM category c
                    WHERE c.id = elem::int
                )

            -- Else return element as-is
            ELSE elem
        END
    ) AS map
FROM banner b
LEFT JOIN LATERAL 
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(b.map::jsonb) = 'array' THEN b.map::jsonb
            ELSE jsonb_build_array(b.map::jsonb)
        END
    ) elem ON true
GROUP BY b.id
ORDER BY b.priority ASC;
    `);

    console.log("Fetched banners:", result.rows);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new banner
router.post("/", async (req, res) => {
  const { name, priority, type, active, map, background, created_at, hidden } =
    req.body;

  console.log("Request body:", req.body);

  try {
    // Convert map to JSON string if it's an object
    const mapJson = typeof map === "object" ? JSON.stringify(map) : map;

    console.log("Processed mapJson:", mapJson);

    const result = await pool.query(
      `INSERT INTO "banner"
				(name, priority, type, active, map, background, created_at, hidden)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 RETURNING *`,
      [name, priority, type, active, mapJson, background, created_at, hidden]
    );
    res.status(201).json({ success: true, banner: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a banner
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priority, type, active, map, background, hidden } = req.body;

  try {
    // Debug logging to see what type value we received
    console.log("Received type value:", type);
    console.log("Type of type:", typeof type);
    console.log("Type value length:", type ? type.length : "undefined");

    // Validate enum type field
    // if (type && !['single', 'slider', 'list', 'timer', 'category'].includes(type)) {
    // 	return res.status(400).json({
    // 		success: false,
    // 		error: 'Invalid type. Type must be one of: "single", "slider", "list", "timer", "category"',
    // 		received_type: type,
    // 		type_of_received: typeof type
    // 	});
    // }

    // Convert map to JSON string if it's an object
    const mapJson = typeof map === "object" ? JSON.stringify(map) : map;

    console.log("Updating banner with ID:", id);
    console.log("Processed mapJson:", mapJson);

    const result = await pool.query(
      `UPDATE "banner" SET 
				name = $1, 
				priority = $2, 
				type = $3, 
				active = $4, 
				map = $5, 
				background = $6, 
				hidden = $7
			WHERE id = $8 
			RETURNING *`,
      [name, priority, type, active, mapJson, background, hidden, id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    res.json({ success: true, banner: result.rows[0] });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a banner
router.delete("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    console.log("Deleting banner with ID:", id);

    const result = await pool.query(
      `DELETE FROM "banner" WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Banner not found" });
    }

    res.json({
      success: true,
      message: "Banner deleted successfully",
      banner: result.rows[0],
    });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/with-products", async (req, res) => {
  try {
    const result = await pool.query(`
SELECT
  b.id,
  b.name,
  b.type,
  b.priority,
  b.background,
  b.active,
  b.hidden,
  b.created_at,
  (
      CASE
          -- 🟩 CATEGORY banners
          WHEN b.type = 'Category' THEN (
              (
                  SELECT json_agg(
                      json_build_object(
                          'id', c.id,
                          'name', c.name,
                          'image', c.image
                      )
                  )
                  FROM banner b2
                  JOIN LATERAL (
                      SELECT 
                          jsonb_array_elements(
                              CASE 
                                  WHEN jsonb_typeof(b2.map::jsonb) = 'array' 
                                  THEN b2.map::jsonb
                                  ELSE jsonb_build_array(b2.map::jsonb)
                              END
                          ) AS obj
                  ) obj_json ON TRUE
                  JOIN LATERAL (
                      SELECT jsonb_array_elements_text(obj_json.obj->'categoryIds')::int AS category_id
                      WHERE jsonb_typeof(obj_json.obj->'categoryIds') = 'array'
                  ) cid ON TRUE
                  LEFT JOIN category c ON c.id = cid.category_id
                  WHERE b2.id = b.id
              )::jsonb
          )

          -- 🟦 OTHER banners (List / Timer / Slider / Single)
          ELSE (
              json_agg(
                  CASE
                      -- ✅ TIMER banners → expand productIds into product objects
                      WHEN b.type = 'Timer' AND jsonb_typeof(elem) = 'object' THEN (
                          json_build_object(
                              'endDate', elem->>'endDate',
                              'products', (
                                  SELECT json_agg(
                                      json_build_object(
                                          'id', p.id,
                                          'name', p.name,
                                          'description', p.description,
                                          'price', p.price,
                                          'endprice', p.endprice,
                                          'primary_image', img.link,
                                          'avg_rating', COALESCE(r.avg_rating, 0),
                                          'rating_count', COALESCE(r.rating_count, 0)
                                      )
                                  )
                                  FROM jsonb_array_elements_text(elem->'productIds') AS pid
                                  JOIN product p ON p.id = pid::int
                                  LEFT JOIN LATERAL (
                                      SELECT link
                                      FROM images i
                                      WHERE i.product_id = p.id
                                      ORDER BY i.priority ASC NULLS LAST, i.id ASC
                                      LIMIT 1
                                  ) img ON TRUE
                                  LEFT JOIN LATERAL (
                                      SELECT 
                                          AVG(value)::numeric(10,2) AS avg_rating,
                                          COUNT(*) AS rating_count
                                      FROM rating r
                                      WHERE r.product_id = p.id
                                  ) r ON TRUE
                              )
                          )::jsonb
                      )

                      -- 🟩 LIST banners → load full product info
                      WHEN b.type = 'List' AND jsonb_typeof(elem) = 'object' THEN (
                          json_build_object(
                              'products', (
                                  SELECT json_agg(
                                      json_build_object(
                                          'id', p.id,
                                          'name', p.name,
                                          'description', p.description,
                                          'price', p.price,
                                          'endprice', p.endprice,
                                          'primary_image', img.link,
                                          'avg_rating', COALESCE(r.avg_rating, 0),
                                          'rating_count', COALESCE(r.rating_count, 0)
                                      )
                                  )
                                  FROM (
                                      SELECT 
                                          CASE 
                                              WHEN jsonb_typeof(value) = 'object' THEN (value->>'id')::int
                                              ELSE value::int
                                          END AS product_id
                                      FROM jsonb_array_elements(elem->'productIds') AS arr(value)
                                  ) pid
                                  JOIN product p ON p.id = pid.product_id
                                  LEFT JOIN LATERAL (
                                      SELECT link
                                      FROM images i
                                      WHERE i.product_id = p.id
                                      ORDER BY i.priority ASC NULLS LAST, i.id ASC
                                      LIMIT 1
                                  ) img ON TRUE
                                  LEFT JOIN LATERAL (
                                      SELECT 
                                          AVG(value)::numeric(10,2) AS avg_rating,
                                          COUNT(*) AS rating_count
                                      FROM rating r
                                      WHERE r.product_id = p.id
                                  ) r ON TRUE
                              )
                          )::jsonb
                      )

                      ELSE elem::jsonb
                  END
              )::jsonb
          )
      END
  ) AS map
FROM banner b
LEFT JOIN LATERAL 
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(b.map::jsonb) = 'array' THEN b.map::jsonb
            ELSE jsonb_build_array(b.map::jsonb)
        END
    ) elem ON TRUE
GROUP BY b.id
ORDER BY b.priority ASC;


    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.get("/with-products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `
    SELECT
  b.id,
  b.name,
  b.type,
  b.priority,
  b.background,
  b.active,
  b.hidden,
  b.created_at,
  (
      CASE
          WHEN b.type = 'Category' THEN (
              (
                  SELECT json_agg(
                      json_build_object(
                          'id', c.id,
                          'name', c.name,
                          'image', c.image
                      )
                  )
                  FROM banner b2
                  JOIN LATERAL (
                      SELECT 
                          jsonb_array_elements(
                              CASE 
                                  WHEN jsonb_typeof(b2.map::jsonb) = 'array' 
                                  THEN b2.map::jsonb
                                  ELSE jsonb_build_array(b2.map::jsonb)
                              END
                          ) AS obj
                  ) obj_json ON TRUE
                  JOIN LATERAL (
                      SELECT jsonb_array_elements_text(obj_json.obj->'categoryIds')::int AS category_id
                      WHERE jsonb_typeof(obj_json.obj->'categoryIds') = 'array'
                  ) cid ON TRUE
                  LEFT JOIN category c ON c.id = cid.category_id
                  WHERE b2.id = b.id
              )::jsonb
          )

          ELSE (
              json_agg(
                  CASE
                      WHEN b.type IN ('List', 'Timer') AND jsonb_typeof(elem) = 'object' THEN (
                          json_build_object(
                              'products', (
                                  SELECT json_agg(
                                      json_build_object(
                                          'id', p.id,
                                          'name', p.name,
                                          'description', p.description,
                                          'price', p.price,
                                          'endprice', p.endprice,
                                          'primary_image', img.link,
                                          'avg_rating', COALESCE(r.avg_rating, 0),
                                          'rating_count', COALESCE(r.rating_count, 0)
                                      )
                                  )
                                  FROM (
                                      SELECT 
                                          CASE 
                                              WHEN jsonb_typeof(value) = 'object' THEN (value->>'id')::int
                                              ELSE value::int
                                          END AS product_id
                                      FROM jsonb_array_elements(elem->'productIds') AS arr(value)
                                  ) pid
                                  JOIN product p ON p.id = pid.product_id
                                  LEFT JOIN LATERAL (
                                      SELECT link
                                      FROM images i
                                      WHERE i.product_id = p.id
                                      ORDER BY i.priority ASC NULLS LAST, i.id ASC
                                      LIMIT 1
                                  ) img ON TRUE
                                  LEFT JOIN LATERAL (
                                      SELECT 
                                          AVG(value)::numeric(10,2) AS avg_rating,
                                          COUNT(*) AS rating_count
                                      FROM rating r
                                      WHERE r.product_id = p.id
                                  ) r ON TRUE
                              )
                          )::jsonb
                      )
                      ELSE elem::jsonb
                  END
              )::jsonb
          )
      END
  ) AS map
FROM banner b
LEFT JOIN LATERAL 
    jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(b.map::jsonb) = 'array' THEN b.map::jsonb
            ELSE jsonb_build_array(b.map::jsonb)
        END
    ) elem ON TRUE
    WHERE b.id = $1
GROUP BY b.id
ORDER BY b.priority ASC
    `,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
