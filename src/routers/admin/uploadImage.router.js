// const express = require("express");
// const pool = require("../../../db");
// const multer = require("multer");
// const { uploadDirect } = require("@uploadcare/upload-client");
// require("dotenv").config();

// const router = express.Router();

// // ✅ Use memory storage so files are kept in RAM, not on disk
// const storage = multer.memoryStorage();
// const upload = multer({ storage });

// router.post("/", upload.single("image"), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         error: true,
//         message: "No file uploaded",
//       });
//     }

//     console.log("Uploading to Uploadcare:", req.file.originalname);
//     const fileData = req.file.buffer;
//     const result = await uploadDirect(fileData, {
//       publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
//       store: "auto",
//       metadata: {
//         filename: req.file.originalname,
//         mimeType: req.file.mimetype,
//       },
//     });

//     router.get("/:id", async (req, res) => {
//       const { id } = req.params;
//       try {
//         // Fetch product
//         const productRes = await pool.query(
//           'SELECT * FROM "product" WHERE id = $1',
//           [id]
//         );
//         if (productRes.rows.length === 0) {
//           return res.status(404).json({ error: "Product not found" });
//         }
//         const product = productRes.rows[0];

//         // Fetch images for this product, ordered by priority
//         const imagesRes = await pool.query(
//           "SELECT link FROM images WHERE product_id = $1 ORDER BY priority ASC, id ASC",
//           [id]
//         );
//         const images = imagesRes.rows.map((row) => row.link);

//         // Attach images array to product
//         product.images = images;

//         res.json(product);
//       } catch (err) {
//         res.status(500).json({ error: err.message });
//       }
//     });

//     console.log("✅ Uploadcare upload successful:", result.uuid);
//     const link = `https://2jde1l5c2b.ucarecd.net/${result.uuid}/-/preview/909x1000/`;

//     res.json({
//       success: true,
//       imageUrl: link,
//       message: "Image uploaded successfully",
//     });
//   } catch (error) {
//     console.error("Uploadcare error:", error);
//     res.status(500).json({
//       error: true,
//       message: error.message,
//     });
//   }
// });

// router.put("/set-primary-image/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     // Get the product_id for the image
//     const result = await pool.query(
//       `SELECT product_id FROM images WHERE id = $1`,
//       [id]
//     );
//     if (result.rows.length === 0)
//       return res.status(404).json({ error: "Image not found" });
//     const productId = result.rows[0].product_id;

//     // Set all images for this product to priority +1 (secondary images)
//     await pool.query(
//       `UPDATE images SET priority = priority + 1 WHERE product_id = $1 AND id != $2`,
//       [productId, id]
//     );
//     await pool.query(`UPDATE images SET priority = 1 WHERE id = $1`, [id]);

//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.put("/set-secondary-priority/:id", async (req, res) => {
//   const { id } = req.params;
//   const { priority } = req.body;
//   try {
//     const result = await pool.query(
//       `SELECT product_id FROM images WHERE id = $1`,
//       [id]
//     );
//     if (result.rows.length === 0)
//       return res.status(404).json({ error: "Image not found" });
//     const productId = result.rows[0].product_id;

//     // Increment priorities for images with priority >= new priority, except the selected image
//     await pool.query(
//       `UPDATE images SET priority = priority + 1 WHERE product_id = $1 AND id != $2 AND priority >= $3`,
//       [productId, id, priority]
//     );

//     // Set the selected image to the new priority
//     await pool.query(`UPDATE images SET priority = $1 WHERE id = $2`, [
//       priority,
//       id,
//     ]);

//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post("/save-product-image", upload.single("image"), async (req, res) => {
//   try {
//     const { product_id } = req.body;
//     let { priority } = req.body;

//     if (!req.file) {
//       return res.status(400).json({
//         error: true,
//         message: "No file uploaded",
//       });
//     }

//     // Upload to Uploadcare
//     const fileData = req.file.buffer;
//     const result = await uploadDirect(fileData, {
//       publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
//       store: "auto",
//       metadata: {
//         filename: req.file.originalname,
//         mimeType: req.file.mimetype,
//       },
//     });

//     const link = `https://2jde1l5c2b.ucarecd.net/${result.uuid}/-/preview/909x1000/`;

//     // Check if there is already a primary image
//     const primaryRes = await pool.query(
//       `SELECT id FROM images WHERE product_id = $1 AND priority = 1 LIMIT 1`,
//       [product_id]
//     );

//     if (primaryRes.rows.length === 0) {
//       priority = 1; // No primary image, set this as primary
//     } else {
//       // Find max priority for this product
//       const maxRes = await pool.query(
//         `SELECT MAX(priority) as max_priority FROM images WHERE product_id = $1`,
//         [product_id]
//       );
//       priority = (maxRes.rows[0].max_priority || 1) + 1;
//     }

//     // Save image info to images table
//     await pool.query(
//       `INSERT INTO images (product_id, link, priority) VALUES ($1, $2, $3)`,
//       [product_id, link, priority]
//     );

//     res.json({
//       success: true,
//       imageUrl: link,
//       message: "Image uploaded and saved successfully",
//     });
//   } catch (error) {
//     console.error("❌ Uploadcare error:", error);
//     res.status(500).json({
//       error: true,
//       message: error.message,
//     });
//   }
// });

// // Add to your images router
// router.get("/product-images/:productId", async (req, res) => {
//   const { productId } = req.params;
//   try {
//     const result = await pool.query(
//       `SELECT * FROM images WHERE product_id = $1 ORDER BY priority ASC, id ASC`,
//       [productId]
//     );
//     res.json(result.rows);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.delete("/delete-image/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     await pool.query(`DELETE FROM images WHERE id = $1`, [id]);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// router.put("/update-image-priority/:id", async (req, res) => {
//   const { id } = req.params;
//   const { priority } = req.body;
//   try {
//     await pool.query(`UPDATE images SET priority = $1 WHERE id = $2`, [
//       priority,
//       id,
//     ]);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
// module.exports = router;



const express = require("express");
const pool = require("../../../db");
const multer = require("multer");
const { uploadDirect } = require("@uploadcare/upload-client");
require("dotenv").config();

const router = express.Router();

// ✅ Use memory storage for Uploadcare
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "No file uploaded",
      });
    }

    console.log("📤 Uploading to Uploadcare:", req.file.originalname);

    const fileData = req.file.buffer;
    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
      metadata: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
      },
    });

    console.log("✅ Uploadcare upload successful:", result.uuid);

  // old uploadcare link
    // const link = `https://2jde1l5c2b.ucarecdn.com/${result.uuid}/-/preview/909x1000/`;

//new upload care link
const link = `https://48o5fv350s.ucarecd.net/${result.uuid}/-/preview/909x1000/`;

    res.json({
      success: true,
      imageUrl: link,
      message: "Image uploaded successfully",
    });
  } catch (error) {
    console.error("❌ Uploadcare error:", error);
    res.status(500).json({
      error: true,
      message: error.message,
    });
  }
});


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

    product.images = imagesRes.rows.map((row) => row.link);
    res.json(product);
  } catch (err) {
    console.error("❌ Error fetching product:", err);
    res.status(500).json({ error: err.message });
  }
});


router.post("/save-product-image", upload.single("image"), async (req, res) => {
  try {
    const { product_id } = req.body;
    let { priority } = req.body;

    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: "No file uploaded",
      });
    }

    // Upload to Uploadcare
    const fileData = req.file.buffer;
    const result = await uploadDirect(fileData, {
      publicKey: process.env.UPLOADCARE_PUBLIC_KEY,
      store: "auto",
      metadata: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
      },
    });
 // old uploadcare link
    // const link = `https://2jde1l5c2b.ucarecdn.com/${result.uuid}/-/preview/909x1000/`;

//new upload care link
const link = `https://48o5fv350s.ucarecd.net/${result.uuid}/-/preview/909x1000/`;



    // Determine priority
    const primaryRes = await pool.query(
      `SELECT id FROM images WHERE product_id = $1 AND priority = 1 LIMIT 1`,
      [product_id]
    );

    if (primaryRes.rows.length === 0) {
      priority = 1; // First image → primary
    } else {
      const maxRes = await pool.query(
        `SELECT MAX(priority) AS max_priority FROM images WHERE product_id = $1`,
        [product_id]
      );
      priority = (maxRes.rows[0].max_priority || 1) + 1;
    }

    // Save image info
    await pool.query(
      `INSERT INTO images (product_id, link, priority) VALUES ($1, $2, $3)`,
      [product_id, link, priority]
    );

    res.json({
      success: true,
      imageUrl: link,
      message: "Image uploaded and saved successfully",
    });
  } catch (error) {
    console.error("❌ Uploadcare error:", error);
    res.status(500).json({
      error: true,
      message: error.message,
    });
  }
});


router.put("/set-primary-image/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT product_id FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Image not found" });

    const productId = result.rows[0].product_id;

    // Demote all others and set this one as primary
    await pool.query(
      `UPDATE images SET priority = priority + 1 WHERE product_id = $1 AND id != $2`,
      [productId, id]
    );
    await pool.query(`UPDATE images SET priority = 1 WHERE id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error setting primary image:", err);
    res.status(500).json({ error: err.message });
  }
});


router.put("/set-secondary-priority/:id", async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;
  try {
    const result = await pool.query(
      `SELECT product_id FROM images WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Image not found" });

    const productId = result.rows[0].product_id;

    await pool.query(
      `UPDATE images SET priority = priority + 1 WHERE product_id = $1 AND id != $2 AND priority >= $3`,
      [productId, id, priority]
    );
    await pool.query(`UPDATE images SET priority = $1 WHERE id = $2`, [
      priority,
      id,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating secondary priority:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 6️⃣  Get all images for a specific product
// ============================================================================
router.get("/product-images/:productId", async (req, res) => {
  const { productId } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM images WHERE product_id = $1 ORDER BY priority ASC, id ASC`,
      [productId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching product images:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 7️⃣  Delete an image
// ============================================================================
router.delete("/delete-image/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM images WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting image:", err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 8️⃣  Update image priority manually
// ============================================================================
router.put("/update-image-priority/:id", async (req, res) => {
  const { id } = req.params;
  const { priority } = req.body;
  try {
    await pool.query(`UPDATE images SET priority = $1 WHERE id = $2`, [
      priority,
      id,
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating image priority:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
