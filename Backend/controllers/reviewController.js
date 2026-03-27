const Review = require('../models/reviewModel');

// GET /api/reviews — public, approved only
exports.getApprovedReviews = async (req, res) => {
  try {
    const reviews = await Review.findAll({
      where: { status: 'approved' },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, reviews });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/reviews — public submit
exports.submitReview = async (req, res) => {
  try {
    const { author, role, text, rating } = req.body;
    if (!author || !text) return res.status(400).json({ success: false, message: 'Name and review are required' });
    await Review.create({ author, role: role || '', text, rating: Math.min(5, Math.max(1, parseInt(rating) || 5)), status: 'approved' });
    res.json({ success: true, message: 'Review submitted! It will appear after approval.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/reviews/admin/all — admin
exports.getAllReviews = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { count, rows } = await Review.findAndCountAll({
      order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit
    });
    res.json({ success: true, reviews: rows, currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/reviews/:id/status — admin approve/reject
exports.updateStatus = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Not found' });
    await review.update({ status: req.body.status });
    res.json({ success: true, review });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/reviews/:id — admin
exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findByPk(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Not found' });
    await review.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
