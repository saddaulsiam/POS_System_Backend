import { body } from "express-validator";

const authValidator = {
  login: [
    body("username").notEmpty().withMessage("Username is required"),
    body("pinCode").isLength({ min: 4, max: 6 }).withMessage("PIN must be 4-6 digits"),
  ],
  changePin: [
    body("currentPin").isLength({ min: 4, max: 6 }).withMessage("Current PIN must be 4-6 digits"),
    body("newPin").isLength({ min: 4, max: 6 }).withMessage("New PIN must be 4-6 digits"),
  ],
  registerStore: [
    body("storeName").trim().notEmpty().withMessage("Store name is required"),
    body("ownerName").trim().notEmpty().withMessage("Owner name is required"),
    body("ownerUsername")
      .trim()
      .notEmpty()
      .withMessage("Username is required")
      .isLength({ min: 3 })
      .withMessage("Username must be at least 3 characters"),
    body("ownerPin").isLength({ min: 4, max: 6 }).withMessage("PIN must be 4-6 digits"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("phone").optional().trim(),
    body("address").optional().trim(),
    body("city").optional().trim(),
    body("country").optional().trim(),
  ],
};

export default authValidator;
