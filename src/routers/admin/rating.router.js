const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all ratings
router.get('/', async (req, res) => {
	try {
		const result = await pool.query('SELECT * FROM "rating"');
		res.json(result.rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// Create a new rating
router.post('/', async (req, res) => {
	const {
		user_id,
		product_id,
		value
	} = req.body;

	try {
		const result = await pool.query(
			`INSERT INTO "rating"
				(user_id, product_id, value)
			 VALUES ($1, $2, $3)
			 RETURNING *`,
			[user_id, product_id, value]
		);
		res.status(201).json({ success: true, rating: result.rows[0] });
	} catch (err) {
		res.status(500).json({ success: false, error: err.message });
	}
});

// Update a rating
router.put('/:id', async (req, res) => {
	const { id } = req.params;
	const {
		user_id,
		product_id,
		value
	} = req.body;

	try {
		console.log('Updating rating with ID:', id);
		
		const result = await pool.query(
			`UPDATE "rating" SET 
				user_id = $1, 
				product_id = $2, 
				value = $3
			WHERE id = $4 
			RETURNING *`,
			[user_id, product_id, value, id]
		);
		
		if (result.rows.length === 0) {
			return res.status(404).json({ success: false, message: 'Rating not found' });
		}
		
		res.json({ success: true, rating: result.rows[0] });
	} catch (err) {
		console.log('Database error:', err.message);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Delete a rating
router.delete('/:id', async (req, res) => {
	const { id } = req.params;
	
	try {
		console.log('Deleting rating with ID:', id);
		
		const result = await pool.query(
			`DELETE FROM "rating" WHERE id = $1 RETURNING *`,
			[id]
		);
		
		if (result.rows.length === 0) {
			return res.status(404).json({ success: false, message: 'Rating not found' });
		}
		
		res.json({ success: true, message: 'Rating deleted successfully', rating: result.rows[0] });
	} catch (err) {
		console.log('Database error:', err.message);
		res.status(500).json({ success: false, error: err.message });
	}
});

module.exports = router;