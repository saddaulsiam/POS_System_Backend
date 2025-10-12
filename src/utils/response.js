// Centralized response helpers

export function success(res, data, status = 200) {
  return res.status(status).json(data);
}

export function error(res, message, status = 500, details) {
  return res.status(status).json({ error: message, details });
}
