const readPatch = () => ({ isRead: true });
const pushResult = (status) => status >= 200 && status < 300 ? "delivered" : status === 404 || status === 410 ? "expired" : "failed";
module.exports = { readPatch, pushResult };
