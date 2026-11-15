const crypto = require('node:crypto');
const { AuthToken } = require('../models');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const ticketHash = jti => hash('2fa-ticket:' + jti);
// A signed ticket must also match the current password and authenticator setup.
const credentialStamp = user => crypto.createHmac('sha256', process.env.JWT_SECRET)
  .update(JSON.stringify([user.id, user.password, user.twoFactorSecret, !!user.twoFactorEnabled, user.tokensValidAfter])).digest('hex');
async function claimProof(userId, proof, transaction) {
  try {
    await AuthToken.create({ userId, kind: '2fa-proof', tokenHash: hash('2fa-proof:' + userId + ':' + proof), expiresAt: new Date(Date.now() + 5 * 60000), usedAt: new Date() }, { transaction });
    return true;
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return false;
    throw error;
  }
}
module.exports = { ticketHash, credentialStamp, claimProof };
