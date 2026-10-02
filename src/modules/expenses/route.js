import { Router } from 'express';
import { expenseController } from './expenseController.js';
import { expenseValidator } from './expenseValidator.js';
import { authenticateToken, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// --- Expense Categories ---
router.get('/categories', expenseController.getCategories);
router.post(
  '/categories',
  authorizeRoles('ADMIN', 'MANAGER', 'OWNER'),
  ...expenseValidator.createCategory,
  expenseController.createCategory
);
router.put(
  '/categories/:id',
  authorizeRoles('ADMIN', 'MANAGER', 'OWNER'),
  ...expenseValidator.updateCategory,
  expenseController.updateCategory
);
router.delete(
  '/categories/:id',
  authorizeRoles('ADMIN', 'MANAGER', 'OWNER'),
  expenseController.deleteCategory
);

// --- Expenses ---
router.get('/', ...expenseValidator.listExpense, expenseController.getExpenses);
router.post(
  '/',
  authorizeRoles('ADMIN', 'MANAGER', 'OWNER'),
  ...expenseValidator.createExpense,
  expenseController.createExpense
);
router.put(
  '/:id',
  authorizeRoles('ADMIN', 'MANAGER', 'OWNER'),
  ...expenseValidator.updateExpense,
  expenseController.updateExpense
);
router.delete(
  '/:id',
  authorizeRoles('ADMIN', 'OWNER'),
  expenseController.deleteExpense
);

export default router;
