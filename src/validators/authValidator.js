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
};

export default authValidator;
