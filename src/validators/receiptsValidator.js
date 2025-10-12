import { param, body } from "express-validator";

export const saleIdParamValidator = [param("saleId").isInt().withMessage("Sale ID must be an integer")];

export const printThermalValidator = [
  body("saleId").isInt().withMessage("Sale ID is required"),
  body("printerName").optional().isString(),
];
