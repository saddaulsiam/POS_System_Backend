import { body } from "express-validator";

const brandValidator = {
  create: [
    body("name")
      .notEmpty()
      .trim()
      .withMessage("Brand name is required")
      .isLength({ max: 50 })
      .withMessage("Brand name cannot exceed 50 characters"),
  ],
  update: [
    body("name")
      .notEmpty()
      .trim()
      .withMessage("Brand name is required")
      .isLength({ max: 50 })
      .withMessage("Brand name cannot exceed 50 characters"),
  ],
};

export default brandValidator;
