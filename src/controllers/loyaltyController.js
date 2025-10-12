import { validationResult } from "express-validator";
import { sendSuccess, sendError } from "../utils/response.js";
import * as loyaltyService from "../services/loyaltyService.js";

const getTiers = async (req, res) => {
  try {
    const result = await loyaltyService.getTiersService();
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch loyalty tiers");
  }
};

const getPointsHistory = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const customerId = parseInt(req.params.customerId);
    const result = await loyaltyService.getPointsHistoryService(customerId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch points history");
  }
};

const redeem = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await loyaltyService.redeemService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to redeem points");
  }
};

const redeemPoints = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await loyaltyService.redeemPointsService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to redeem points");
  }
};

const getRewards = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const customerId = parseInt(req.params.customerId);
    const result = await loyaltyService.getRewardsService(customerId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch rewards");
  }
};

const awardPoints = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await loyaltyService.awardPointsService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, error.message || "Failed to award points");
  }
};

const birthdayRewards = async (req, res) => {
  try {
    const result = await loyaltyService.birthdayRewardsService();
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to process birthday rewards");
  }
};

const getOffers = async (req, res) => {
  try {
    const result = await loyaltyService.getOffersService(req.user);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch loyalty offers");
  }
};

const createOffer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await loyaltyService.createOfferService(req.body);
    sendSuccess(res, result, 201);
  } catch (error) {
    sendError(res, 500, "Failed to create loyalty offer");
  }
};

const updateOffer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const offerId = parseInt(req.params.offerId);
    const result = await loyaltyService.updateOfferService(offerId, req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to update loyalty offer");
  }
};

const deleteOffer = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const offerId = parseInt(req.params.offerId);
    const result = await loyaltyService.deleteOfferService(offerId);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to delete loyalty offer");
  }
};

const loyaltyTierConfig = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const result = await loyaltyService.loyaltyTierConfigService(req.body);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to manage tier configuration");
  }
};

const getStatistics = async (req, res) => {
  try {
    const result = await loyaltyService.getStatisticsService(req.user);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch loyalty statistics");
  }
};

const updateTier = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const customerId = parseInt(req.params.customerId);
    const { tier } = req.body;
    const result = await loyaltyService.updateCustomerTierService(customerId, tier);
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to update customer tier");
  }
};

const getLoyaltyStatus = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return sendError(res, 400, errors.array());
    const customerId = parseInt(req.params.customerId);
    const result = await loyaltyService.getLoyaltyStatusService(customerId);
    if (!result) return sendError(res, 404, "Customer not found");
    sendSuccess(res, result);
  } catch (error) {
    sendError(res, 500, "Failed to fetch loyalty status");
  }
};

export {
  getTiers,
  getPointsHistory,
  redeem,
  redeemPoints,
  getRewards,
  awardPoints,
  birthdayRewards,
  getOffers,
  createOffer,
  updateOffer,
  deleteOffer,
  updateTier,
  getLoyaltyStatus,
  loyaltyTierConfig,
  getStatistics,
};
