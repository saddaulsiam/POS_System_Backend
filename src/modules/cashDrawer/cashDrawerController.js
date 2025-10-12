import { cashDrawerService } from "./cashDrawerService.js";

async function getAll(req, res) {
  try {
    const result = await cashDrawerService.getAll(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching cash drawers:", error);
    res.status(500).json({ error: "Failed to fetch cash drawers" });
  }
}

async function getCurrent(req, res) {
  try {
    const result = await cashDrawerService.getCurrent(req.user);
    res.json(result);
  } catch (error) {
    console.error("Error fetching current drawer:", error);
    res.status(500).json({ error: "Failed to fetch current drawer" });
  }
}

async function openDrawer(req, res) {
  try {
    const result = await cashDrawerService.openDrawer(req.user, req.body);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error opening cash drawer:", error);
    res.status(500).json({ error: "Failed to open cash drawer" });
  }
}

async function closeDrawer(req, res) {
  try {
    const result = await cashDrawerService.closeDrawer(req.user, req.params, req.body);
    res.json(result);
  } catch (error) {
    console.error("Error closing cash drawer:", error);
    res.status(500).json({ error: "Failed to close cash drawer" });
  }
}

async function getById(req, res) {
  try {
    const result = await cashDrawerService.getById(req.user, req.params);
    res.json(result);
  } catch (error) {
    console.error("Error fetching cash drawer:", error);
    res.status(500).json({ error: "Failed to fetch cash drawer" });
  }
}

async function getReconciliation(req, res) {
  try {
    const result = await cashDrawerService.getReconciliation(req.user, req.params);
    res.json(result);
  } catch (error) {
    console.error("Error fetching reconciliation:", error);
    res.status(500).json({ error: "Failed to fetch reconciliation details" });
  }
}

async function getSummary(req, res) {
  try {
    const result = await cashDrawerService.getSummary(req.query);
    res.json(result);
  } catch (error) {
    console.error("Error fetching drawer statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
}

export const cashDrawerController = {
  getAll,
  getCurrent,
  openDrawer,
  closeDrawer,
  getById,
  getReconciliation,
  getSummary,
};
