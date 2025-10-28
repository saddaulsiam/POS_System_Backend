export function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data);
}

export function sendError(res, status = 500, message, details) {
  return res.status(status).json({ error: message, details });
}
