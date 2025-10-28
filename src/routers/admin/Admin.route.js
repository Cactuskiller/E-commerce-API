const express = require("express");
const pool = require("../../../db");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
require("dotenv").config();

const SALT_ROUNDS = 10;

const router = express.Router();

// Admin Signup
router.post("/signup", async (req, res) => {
  const {
    name,
    username,
    email,
    password,
    role,
    status
  } = req.body;

  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    const result = await pool.query(
      `INSERT INTO admin 
        (name, username, email, password_hash, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, name, username, email, role, status, created_at, updated_at`,
      [name, username, email, hashedPassword, role || 'admin', status !== false]
    );

    // Create JWT payload for admin
    const payload = {
      adminId: result.rows[0].id,
      username: result.rows[0].username,
      email: result.rows[0].email,
      role: result.rows[0].role,
      isAdmin: true
    };

    // Sign JWT token with admin secret (or regular secret)
    const token = JWT.sign(payload, process.env.ADMIN_SECRET || process.env.secret, {
      expiresIn: "7d",
    });

    res.status(201).json({ 
      success: true, 
      token: token,
      admin: result.rows[0]
    });
  } catch (err) {
    if (err.code === '23505') { // Unique constraint violation
      res.status(400).json({ success: false, error: "Username or email already exists" });
    } else {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// Admin Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM admin WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    const admin = result.rows[0];

    // Check if admin account is active
    if (!admin.status) {
      return res.status(401).json({ 
        success: false, 
        message: "Account is deactivated" 
      });
    }

    // Compare password
    const match = await bcrypt.compare(password, admin.password_hash);

    if (!match) {
      return res.status(401).json({ 
        success: false, 
        message: "Invalid credentials" 
      });
    }

    // Create JWT payload
    const payload = {
      adminId: admin.id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      isAdmin: true
    };

    // Sign JWT token
    const token = JWT.sign(payload, process.env.ADMIN_SECRET || process.env.secret, {
      expiresIn: "7d",
    });

    // Remove password from response
    const { password_hash, ...adminWithoutPassword } = admin;

    res.json({ 
      success: true, 
      token: token, 
      admin: adminWithoutPassword 
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get admin profile (protected route example)
router.get("/profile", async (req, res) => {
  // This would need admin auth middleware
  res.json({
    message: "This endpoint requires admin authentication middleware"
  });
});

module.exports = router;
