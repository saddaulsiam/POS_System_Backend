import { query } from "express-validator";

const analyticsValidator = {
  overview: [
    query("startDate").optional().isISO8601().withMessage("Start date must be valid"),
    query("endDate").optional().isISO8601().withMessage("End date must be valid"),
    query("period").optional().isIn(["today", "yesterday", "week", "lastWeek", "month", "lastMonth"]),
  ],
  salesTrend: [
    query("period").optional().isIn(["today", "week", "month", "lastMonth"]),
    query("groupBy").optional().isIn(["hour", "day", "week", "month"]),
  ],
  topProducts: [
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("limit").optional().isInt({ min: 1, max: 50 }),
  ],
  categoryBreakdown: [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
  customerStats: [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
  paymentMethods: [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
};

export default analyticsValidator;
