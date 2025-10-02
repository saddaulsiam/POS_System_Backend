const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: "24h" });
};

const generateReceiptId = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0");
  return `R${timestamp.slice(-6)}${random}`;
};

const calculateTax = (amount, taxRate = 0) => {
  return amount * (taxRate / 100);
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const generatePONumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `PO${timestamp.slice(-6)}${random}`;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  generateReceiptId,
  calculateTax,
  formatCurrency,
  generatePONumber,
};
