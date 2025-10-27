import { body } from "express-validator";

const categoryValidator = {
  create: [body("name").notEmpty().trim().withMessage("Category name is required")],
  update: [body("name").notEmpty().trim().withMessage("Category name is required")],
};

export default categoryValidator;
