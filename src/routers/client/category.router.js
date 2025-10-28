const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all categories
router.get("/", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM "category"');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new category
router.post("/", async (req, res) => {
  const { name, priority, active, image } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO "category" (name, priority, active, image, created_at)
			 VALUES ($1, $2, $3, $4, NOW())
			 RETURNING *`,
      [name, priority, active, image]
    );
    res.status(201).json({ success: true, category: result.rows[0] });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update a category
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { name, priority, active, image } = req.body;
  try {
    const result = await pool.query(
      `UPDATE "category" SET name = $1, priority = $2, active = $3, image = $4 WHERE id = $5 RETURNING *`,
      [name, priority, active, image, id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, category: result.rows[0] });
  } catch (err) {
    console.log("Database error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a category
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // the query part
    const result = await pool.query(
      `DELETE FROM "category" WHERE id = $1 RETURNING *`,
      [id]
    );

    //the if stsatement
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }
    res.json({ success: true, category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
