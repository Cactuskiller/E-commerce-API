const JWT = require("jsonwebtoken");

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  JWT.verify(token, process.env.ADMIN_SECRET, (err, admin) => {
    if (err) {
      return res.status(403).json({ message: "Invalid token" });
    }

    // Check if the token is for an admin
    if (!admin.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    req.admin = admin;
    next();
  });
}

module.exports = authenticateAdmin;