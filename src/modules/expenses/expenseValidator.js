import { body, query } from 'express-validator';

export const expenseValidator = {
  createCategory: [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('isActive').optional().isBoolean(),
  ],
  updateCategory: [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('isActive').optional().isBoolean(),
  ],
  createExpense: [
    body('categoryId').isInt().withMessage('Category ID must be an integer'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('date').optional().isISO8601().withMessage('Invalid date format'),
    body('referenceNo').optional().isString(),
    body('note').optional().isString(),
  ],
  updateExpense: [
    body('categoryId').optional().isInt(),
    body('amount').optional().isFloat({ min: 0 }),
    body('date').optional().isISO8601(),
    body('referenceNo').optional().isString(),
    body('note').optional().isString(),
  ],
  listExpense: [
    query('page').optional({ checkFalsy: true }).isInt({ min: 1 }),
    query('limit').optional({ checkFalsy: true }).isInt({ min: 1 }),
    query('categoryId').optional({ checkFalsy: true }).isInt(),
    query('startDate').optional({ checkFalsy: true }).isISO8601(),
    query('endDate').optional({ checkFalsy: true }).isISO8601(),
  ]
};
