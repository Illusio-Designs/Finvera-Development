const express = require('express');
const router = express.Router();

const placeholder = (req, res) => res.status(503).json({ success: false, message: 'Service initializing' });

let submitContact       = placeholder;
let subscribeNewsletter = placeholder;
let getInquiries        = placeholder;
let updateInquiryStatus = placeholder;
let deleteInquiry       = placeholder;
let getSubscribers      = placeholder;
let deleteSubscriber    = placeholder;

try {
  const ctrl = require('../controllers/contactController');
  if (typeof ctrl.submitContact       === 'function') submitContact       = ctrl.submitContact;
  if (typeof ctrl.subscribeNewsletter === 'function') subscribeNewsletter = ctrl.subscribeNewsletter;
  if (typeof ctrl.getInquiries        === 'function') getInquiries        = ctrl.getInquiries;
  if (typeof ctrl.updateInquiryStatus === 'function') updateInquiryStatus = ctrl.updateInquiryStatus;
  if (typeof ctrl.deleteInquiry       === 'function') deleteInquiry       = ctrl.deleteInquiry;
  if (typeof ctrl.getSubscribers      === 'function') getSubscribers      = ctrl.getSubscribers;
  if (typeof ctrl.deleteSubscriber    === 'function') deleteSubscriber    = ctrl.deleteSubscriber;
} catch (e) {
  console.error('[contactRoutes] Controller load error:', e.message);
}

let authenticate = (req, res, next) => next();
try {
  const auth = require('../middleware/auth');
  if (typeof auth.authenticate === 'function') authenticate = auth.authenticate;
} catch (e) {
  console.error('[contactRoutes] Auth middleware load error:', e.message);
}

// Public
router.post('/',           submitContact);
router.post('/newsletter', subscribeNewsletter);

// Admin
router.get('/inquiries',               authenticate, getInquiries);
router.patch('/inquiries/:id/status',  authenticate, updateInquiryStatus);
router.delete('/inquiries/:id',        authenticate, deleteInquiry);
router.get('/subscribers',             authenticate, getSubscribers);
router.delete('/subscribers/:id',      authenticate, deleteSubscriber);

module.exports = router;
