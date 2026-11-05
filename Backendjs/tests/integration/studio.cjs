// Explicitly opt in against an isolated local database. No external Meta calls.
if (process.env.FINVERA_INTEGRATION_TESTS !== '1') throw new Error('Explicit integration-test opt-in required.');
require('dotenv').config({ path: require('node:path').resolve(__dirname, '../../.env') });
if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.DB_HOST || 'localhost')) throw new Error('Use a local test database.');
const assert = require('node:assert/strict');
const { sequelize, SocialAccount, SocialPublishJob } = require('../../src/models');
const meta = require('../../src/utils/meta');
const auto = require('../../src/utils/autoPublish');
const studio = require('../../src/controllers/studio.controller');
const client = `Studio test ${Date.now()}`;
const originals = { sync: auto.syncBrand, configured: meta.configured, profile: meta.fetchProfile, metrics: meta.fetchPostMetrics, accounts: SocialAccount.findAll, jobs: SocialPublishJob.findAll };
async function pause(platform, paused) {
  let status = 200, body;
  await studio.pause({ params: { client }, body: { platform, paused } }, { status(code) { status = code; return this; }, json(value) { body = value; } }, error => { throw error; });
  return { status, body };
}
(async () => {
  try {
    await sequelize.authenticate();
    const account = await SocialAccount.create({ client, pageId: 'test-only', pageToken: 'test-only-not-real', pageName: client, status: 'connected', paused: [] });
    auto.syncBrand = async () => {};
    assert.equal((await pause('instagram', 'false')).status, 400);
    await Promise.all([pause('instagram', true), pause('facebook', true)]);
    await account.reload();
    assert.deepEqual([...account.paused].sort(), ['facebook', 'instagram']);
    await pause('instagram', false);
    await account.reload();
    assert.deepEqual(account.paused, ['facebook']);
    let updates = [];
    const job = { client, platform: 'instagram', status: 'published', remoteId: 'local-test', publishedAt: new Date(), metricsAt: null, update: async data => updates.push(data) };
    SocialAccount.findAll = async () => [account];
    SocialPublishJob.findAll = async () => [job];
    meta.configured = () => true;
    meta.fetchProfile = async () => ({});
    meta.fetchPostMetrics = async () => ({});
    await studio.refreshAllStudio({ force: true });
    assert.equal(updates.length, 0, 'empty external response must retain prior metrics and freshness');
    meta.fetchPostMetrics = async () => ({ likes: 0, comments: 0 });
    await studio.refreshAllStudio({ force: true });
    assert.equal(updates.length, 1);
    assert.deepEqual(updates[0].metrics, { likes: 0, comments: 0 });
    console.log('PASS: concurrent platform pause/resume, boolean validation, failed metric preservation and genuine zero metrics. No external writes.');
  } finally {
    auto.syncBrand = originals.sync; meta.configured = originals.configured; meta.fetchProfile = originals.profile; meta.fetchPostMetrics = originals.metrics;
    SocialAccount.findAll = originals.accounts; SocialPublishJob.findAll = originals.jobs;
    await SocialAccount.destroy({ where: { client } });
    await sequelize.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
