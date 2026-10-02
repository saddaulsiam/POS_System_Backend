import { expenseService } from './expenseService.js';
import { validationResult } from 'express-validator';

export const expenseController = {
  // --- Categories ---
  getCategories: async (req, res, next) => {
    try {
      const categories = await expenseService.getCategories(req.user.storeId);
      res.json(categories);
    } catch (error) {
      next(error);
    }
  },

  createCategory: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const category = await expenseService.createCategory(req.user.storeId, req.body);
      res.status(201).json(category);
    } catch (error) {
      if (error.message.includes('already exists')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  },

  updateCategory: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const category = await expenseService.updateCategory(
        req.user.storeId,
        parseInt(req.params.id),
        req.body
      );
      res.json(category);
    } catch (error) {
      next(error);
    }
  },

  deleteCategory: async (req, res, next) => {
    try {
      await expenseService.deleteCategory(req.user.storeId, parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      if (error.message.includes('Cannot delete category')) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  },

  // --- Expenses ---
  getExpenses: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const result = await expenseService.getExpenses(req.user.storeId, req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  createExpense: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const expense = await expenseService.createExpense(
        req.user.storeId,
        req.user.id,
        req.body
      );
      res.status(201).json(expense);
    } catch (error) {
      next(error);
    }
  },

  updateExpense: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

      const expense = await expenseService.updateExpense(
        req.user.storeId,
        parseInt(req.params.id),
        req.body
      );
      res.json(expense);
    } catch (error) {
      next(error);
    }
  },

  deleteExpense: async (req, res, next) => {
    try {
      await expenseService.deleteExpense(req.user.storeId, parseInt(req.params.id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
