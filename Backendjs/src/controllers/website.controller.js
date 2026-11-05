const { fn, col } = require('sequelize');
const models = require('../models');
const { asyncHandler } = require('../utils/crud');

const COLLECTIONS = {
  projects: 'Project', services: 'Service', blog: 'BlogPost', pages: 'Page', team: 'TeamMember', testimonials: 'Testimonial',
  faqs: 'Faq', values: 'Value', brands: 'Brand', milestones: 'Milestone', 'process-steps': 'ProcessStep', stats: 'Stat', logos: 'Logo', features: 'Feature',
};
const overview = asyncHandler(async (_req, res) => {
  const collections = await Promise.all(Object.entries(COLLECTIONS).map(async ([resource, model]) => {
    const groups = await models[model].findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('MAX', col('updatedAt')), 'updatedAt']], group: ['status'], raw: true });
    const count = status => groups.filter(row => row.status === status).reduce((sum, row) => sum + Number(row.count), 0);
    const dates = groups.map(row => row.updatedAt && new Date(row.updatedAt).getTime()).filter(Number.isFinite);
    return { resource, total: groups.reduce((sum, row) => sum + Number(row.count), 0), published: count('published'), draft: count('draft'), updatedAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null };
  }));
  res.json({ collections });
});
module.exports = { overview, COLLECTIONS };
