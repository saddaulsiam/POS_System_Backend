import { body } from "express-validator";

export const updateProfileValidator = [
  body("name").optional().notEmpty().trim().withMessage("Name cannot be empty"),
  body("username").optional().notEmpty().trim().withMessage("Username cannot be empty"),
];
