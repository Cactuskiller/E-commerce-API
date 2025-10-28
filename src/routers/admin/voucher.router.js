// const express = require("express");
// const pool = require("../../../db");

// const router = express.Router();


// // Get all vouchers
// router.get('/', async (req, res) => {
// 	try {
// 		const result = await pool.query('SELECT * FROM "voucher"');
// 		res.json(result.rows);
// 	} catch (err) {
// 		res.status(500).json({ error: err.message });
// 	}
// });

// // Get voucher by code
// router.get('/code/:code', async (req, res) => {
// 	const { code } = req.params;
// 	try {
// 		const result = await pool.query(
// 			`SELECT * FROM "voucher" 
// 			 WHERE code = $1 AND active = true AND expire_date > NOW()`,
// 			[code]
// 		);

// 		if (result.rows.length === 0) {
// 			return res.status(404).send("voucher not found");
// 		}

// 		res.json(result.rows[0]); // return the voucher with this code
// 	} catch (err) {
// 		console.error("Error while fetching voucher by code:", err.message);
// 		res.status(500).send(`Server error: ${err.message}`);
// 	}
// });

// // Create a new voucher
// router.post('/', async (req, res) => {
// 	const {
// 		name,
// 		code,
// 		type,
// 		min_value,
// 		max_value,
// 		expire_date,
// 		active,
// 		created_at,
// 		is_first,
// 		no_of_usage
// 	} = req.body;

// 	try {
// 		// Validate enum type field
// 		if (!type || !['num', 'per'].includes(type)) {
// 			return res.status(400).json({ 
// 				success: false, 
// 				error: 'Invalid type. Type must be either "num" or "per"' 
// 			});
// 		}

// 		const result = await pool.query(
// 			`INSERT INTO "voucher"
// 				(name, code, type, min_value, max_value, expire_date, active, created_at, is_first, no_of_usage)
// 			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
// 			 RETURNING *`,
// 			[name, code, type, min_value, max_value, expire_date, active, created_at, is_first, no_of_usage]
// 		);
// 		res.status(201).json({ success: true, voucher: result.rows[0] });
// 	} catch (err) {
// 		res.status(500).json({ success: false, error: err.message });
// 	}
// });


// // Update a voucher
// router.put('/:id', async (req, res) => {
// 	const { id } = req.params;
// 	const {
// 		name,
// 		code,
// 		type,
// 		min_value,
// 		max_value,
// 		expire_date,
// 		active,
// 		is_first,
// 		no_of_usage
// 	} = req.body;

// 	try {
// 		// Validate enum type field
// 		if (type && !['num', 'per'].includes(type)) {
// 			return res.status(400).json({ 
// 				success: false, 
// 				error: 'Invalid type. Type must be either "num" or "per"' 
// 			});
// 		}

// 		console.log('Updating voucher with ID:', id);
		
// 		const result = await pool.query(
// 			`UPDATE "voucher" SET 
// 				name = $1, 
// 				code = $2, 
// 				type = $3, 
// 				min_value = $4, 
// 				max_value = $5, 
// 				expire_date = $6, 
// 				active = $7, 
// 				is_first = $8, 
// 				no_of_usage = $9
// 			WHERE id = $10 
// 			RETURNING *`,
// 			[name, code, type, min_value, max_value, expire_date, active, is_first, no_of_usage, id]
// 		);
		
// 		if (result.rows.length === 0) {
// 			return res.status(404).json({ success: false, message: 'Voucher not found' });
// 		}
		
// 		res.json({ success: true, voucher: result.rows[0] });
// 	} catch (err) {
// 		console.log('Database error:', err.message);
// 		res.status(500).json({ success: false, error: err.message });
// 	}
// });

// // Delete a voucher
// router.delete('/:id', async (req, res) => {
// 	const { id } = req.params;
	
// 	try {
// 		console.log('Deleting voucher with ID:', id);
		
// 		const result = await pool.query(
// 			`DELETE FROM "voucher" WHERE id = $1 RETURNING *`,
// 			[id]
// 		);
		
// 		if (result.rows.length === 0) {
// 			return res.status(404).json({ success: false, message: 'Voucher not found' });
// 		}
		
// 		res.json({ success: true, message: 'Voucher deleted successfully', voucher: result.rows[0] });
// 	} catch (err) {
// 		console.log('Database error:', err.message);
// 		res.status(500).json({ success: false, error: err.message });
// 	}
// });

// module.exports = router;

const express = require("express");
const pool = require("../../../db");

const router = express.Router();

// Get all vouchers
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM "voucher"');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get voucher by code
router.get('/code/:code', async (req, res) => {
    const { code } = req.params;
    try {
        const result = await pool.query(
            `SELECT * FROM "voucher" 
             WHERE code = $1 AND active = true AND expire_date > NOW()`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).send("voucher not found");
        }

        res.json(result.rows[0]); // return the voucher with this code
    } catch (err) {
        console.error("Error while fetching voucher by code:", err.message);
        res.status(500).send(`Server error: ${err.message}`);
    }
});

// Create a new voucher
router.post('/', async (req, res) => {
    const {
        name,
        code,
        type,
        value,
        min_value,
        max_value,
        expire_date,
        active,
        created_at,
        is_first,
        no_of_usage
    } = req.body;

    try {
        // Validate enum type field
        if (!type || !['num', 'per'].includes(type)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid type. Type must be either "num" or "per"' 
            });
        }

        const result = await pool.query(
            `INSERT INTO "voucher"
                (name, code, type, value, min_value, max_value, expire_date, active, created_at, is_first, no_of_usage)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [name, code, type, value, min_value, max_value, expire_date, active, created_at, is_first, no_of_usage]
        );
        res.status(201).json({ success: true, voucher: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Update a voucher
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const {
        name,
        code,
        type,
        value,
        min_value,
        max_value,
        expire_date,
        active,
        is_first,
        no_of_usage
    } = req.body;

    try {
        // Validate enum type field
        if (type && !['num', 'per'].includes(type)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid type. Type must be either "num" or "per"' 
            });
        }

        console.log('Updating voucher with ID:', id);
        
        const result = await pool.query(
            `UPDATE "voucher" SET 
                name = $1, 
                code = $2, 
                type = $3, 
                value = $4,
                min_value = $5, 
                max_value = $6, 
                expire_date = $7, 
                active = $8, 
                is_first = $9, 
                no_of_usage = $10
            WHERE id = $11 
            RETURNING *`,
            [name, code, type, value, min_value, max_value, expire_date, active, is_first, no_of_usage, id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Voucher not found' });
        }
        
        res.json({ success: true, voucher: result.rows[0] });
    } catch (err) {
        console.log('Database error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Delete a voucher
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        console.log('Deleting voucher with ID:', id);
        
        const result = await pool.query(
            `DELETE FROM "voucher" WHERE id = $1 RETURNING *`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Voucher not found' });
        }
        
        res.json({ success: true, message: 'Voucher deleted successfully', voucher: result.rows[0] });
    } catch (err) {
        console.log('Database error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;