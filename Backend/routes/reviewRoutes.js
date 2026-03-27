const express = require('express');
const router = express.Router();

let getApprovedReviews = (req, res) => res.status(503).json({ success: false, message: 'Initializing' });
let submitReview       = (req, res) => res.status(503).json({ success: false, message: 'Initializing' });
let getAllReviews       = (req, res) => res.status(503).json({ success: false, message: 'Initializing' });
let updateStatus       = (req, res) => res.status(503).json({ success: false, message: 'Initializing' });
let deleteReview       = (req, res) => res.status(503).json({ success: false, message: 'Initializing' });

try {
  const ctrl = require('../controllers/reviewController');
  if (typeof ctrl.getApprovedReviews === 'function') getApprovedReviews = ctrl.getApprovedReviews;
  if (typeof ctrl.submitReview       === 'function') submitReview       = ctrl.submitReview;
  if (typeof ctrl.getAllReviews       === 'function') getAllReviews       = ctrl.getAllReviews;
  if (typeof ctrl.updateStatus       === 'function') updateStatus       = ctrl.updateStatus;
  if (typeof ctrl.deleteReview       === 'function') deleteReview       = ctrl.deleteReview;
} catch (e) { console.error('[reviewRoutes]', e.message); }

let authenticate = (req, res, next) => next();
try {
  const auth = require('../middleware/auth');
  if (typeof auth.authenticate === 'function') authenticate = auth.authenticate;
} catch (e) {}

router.get('/',              getApprovedReviews);
router.post('/',             submitReview);
router.get('/admin/all',     authenticate, getAllReviews);
router.patch('/:id/status',  authenticate, updateStatus);
router.delete('/:id',        authenticate, deleteReview);

module.exports = router;
