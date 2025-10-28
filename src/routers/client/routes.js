const express = require("express");
//user routes
const userRouter = require("./user.router");
const productsRouter = require("./products.router");
const categoryRouter = require("./category.router");
const imageRouter = require("./image.router");
const ratingRouter = require("./rating.router");
const voucherRouter = require("./voucher.router");
const bannerRouter = require("./Banner.router");
const ordersRouter = require("./orders.router");

// Admin routes
const adminAuthRouter = require("../admin/Admin.route");
const adminUserRouter = require("../admin/user.router");
const adminProductsRouter = require("../admin/products.router");
const adminCategoryRouter = require("../admin/category.router");
const adminImageRouter = require("../admin/image.router");
const adminRatingRouter = require("../admin/rating.router");
const adminVoucherRouter = require("../admin/voucher.router");
const adminBannerRouter = require("../admin/Banner.router");
const adminOrdersRouter = require("../admin/orders.router");
const upload = require("../admin/uploadImage.router");

const clientauth = require("../../middleware/clientauth");
const adminauth = require("../../middleware/Adminauth");

const router = express.Router();
//client routes
router.use("/users", userRouter);
router.use("/products", productsRouter);
router.use("/categories", categoryRouter);
router.use("/images", imageRouter);
router.use("/ratings", ratingRouter);
router.use("/vouchers", voucherRouter);
router.use("/banners", bannerRouter);
router.use("/orders", clientauth, ordersRouter);

//admin routes
router.use("/admin", adminAuthRouter); 
router.use("/admin/users", adminauth, adminUserRouter);
router.use("/admin/products", adminProductsRouter);
router.use("/admin/categories", adminauth, adminCategoryRouter);
router.use("/admin/images", adminauth, adminImageRouter);
router.use("/admin/ratings", adminauth, adminRatingRouter);
router.use("/admin/vouchers", adminauth, adminVoucherRouter);
router.use("/admin/banners", adminauth, adminBannerRouter);
router.use("/admin/orders", adminOrdersRouter);
router.use("/admin/upload", upload);

module.exports = router;
