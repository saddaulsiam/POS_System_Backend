import { body, query } from "express-validator";

const customerValidators = {
  list: [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("search").optional().isString().withMessage("Search must be a string"),
  ],
  create: [
    body("name").notEmpty().trim().withMessage("Customer name is required"),
    body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("dateOfBirth").optional().isISO8601().withMessage("Invalid date format"),
    body("address").optional().isString().withMessage("Address must be a string"),
  ],
  update: [
    body("name").optional().notEmpty().trim().withMessage("Customer name cannot be empty"),
    body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
    body("email").optional().isEmail().withMessage("Invalid email address"),
    body("dateOfBirth").optional().isISO8601().withMessage("Invalid date format"),
    body("address").optional().isString().withMessage("Address must be a string"),
  ],
  addLoyalty: [
    body("points").isInt({ min: 1 }).withMessage("Points must be a positive integer"),
    body("reason").optional().isString().withMessage("Reason must be a string"),
  ],
  redeemLoyalty: [body("points").isInt({ min: 1 }).withMessage("Points must be a positive integer")],
};

export default customerValidators;
