require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const routes = require("./src/routers/client/routes");
const app = express();
const PORT = process.env.PORT || 3001;


app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Apply CORS BEFORE routes so responses include CORS headers
// app.use(
//   cors({
//     origin: [
//       "http://192.168.8.1:5173",
//       "http://localhost:5173",
//       "http://192.168.8.1:5173",
//       "http://192.168.8.1:5174",
//     ],
//     credentials: true, // optional, if you're sending cookies or auth headers
//   })
// );


app.use(
  cors({
    origin: [
      "http://192.168.8.1:5173",
      "http://192.168.8.1:5174",
      "http://192.168.8.1:5175", // 👈 your current frontend port
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check for connectivity tests
app.get("/health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: Date.now() });
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", req.headers.origin);
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  next();
});


// API routes
app.use("/", routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Static files served from: ${path.join(__dirname, "uploads")}`);
});
