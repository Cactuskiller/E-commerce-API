const express = require("express");
const pool = require("../../../db");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
require("dotenv").config();


const SALT_ROUNDS = 10;

const router = express.Router();

// Getting all users with pagination , get the pages then limit 10 records for each
router.get("/", async (req, res) => {
 
  const page = Number(req.query.page) > 0 ? Number(req.query.page) : 1;
  const limit = Number(req.query.limit) > 0 ? Number(req.query.limit) : 10;
  const offset = (page - 1) * limit;

  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM "User"');
    const total = Number(countRes.rows[0].count);

    // Get paginated users
    const result = await pool.query(
      `SELECT * FROM "User" ORDER BY id ASC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      users: result.rows,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register a new user
router.post("/signup", async (req, res) => {
  const {
    name,
    user_name,
    phone,
    email,
    avatar,
    active,
    created_at,
    password,
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      `INSERT INTO "User"
				(name, user_name, phone, email, avatar, active, created_at, password)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			 RETURNING *`,
      [
        name,
        user_name,
        phone,
        email,
        avatar,
        active,
        created_at,
        hashedPassword,
      ]
    );

    payload = { userId: result.rows[0].id , userName: result.rows[0].user_name , phone: result.rows[0].phone};

    const token = JWT.sign(payload , process.env.secret , {
      expiresIn: "7d",
    });


    res.status(201).json({ success: true, token: token});
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// User login
router.post("/login", async (req, res) => {
  const { user_name, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM "User" WHERE user_name = $1',
      [user_name]
    );

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    // Create JWT payload
    const payload = {
      userId: user.id,
      userName: user.user_name,
      phone: user.phone,
      email: user.email,
    };

    // Sign JWT token
    const token = JWT.sign(payload, process.env.secret, {
      expiresIn: "7d",
    });

    // Remove password from user object
    const { password: pwd, ...userWithoutPassword } = user;

    res.json({ success: true, token: token, user: userWithoutPassword });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

//update a user
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    user_name,
    phone,
    email,
    avatar,
    active,
    created_at,
    password,
  } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS); // hashing the password if it's being updated
    const result = await pool.query(
      `UPDATE "User" SET name=$1, user_name=$2, phone=$3, email=$4, avatar=$5, active=$6, created_at=$7, password=$8 WHERE id=$9 RETURNING *`,
      [
        name,
        user_name,
        phone,
        email,
        avatar,
        active,
        created_at,
        hashedPassword,
        id,
      ]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a user
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM "User" WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    res.json({
      success: true,
      massage: "User deleted successfully",
      deleted_user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /login for browser visits (informational only)
router.get("/login", (req, res) => {
  res.json({
    message: "Please use POST to /login with user_name and password.",
  });
});

module.exports = router;