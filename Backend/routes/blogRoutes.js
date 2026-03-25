const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Lazy-load controller so any require error is caught at runtime not startup
let ctrl;
try {
  ctrl = require('../controllers/blogController');
} catch (e) {
  console.error('[blogRoutes] Failed to load blogController:', e.message);
  ctrl = {};
}

const safe = (fn) => fn || ((req, res) => res.status(501).json({ success: false, message: 'Not implemented' }));

// Admin routes BEFORE /:slug
router.get('/admin/all', authenticate, safe(ctrl.getAllBlogsAdmin));
router.post('/', authenticate, safe(ctrl.uploadBlogImage), safe(ctrl.createBlog));
router.put('/:id', authenticate, safe(ctrl.uploadBlogImage), safe(ctrl.updateBlog));
router.delete('/:id', authenticate, safe(ctrl.deleteBlog));

// Public routes
router.get('/', safe(ctrl.getAllBlogs));
router.get('/:slug', safe(ctrl.getBlogBySlug));

module.exports = router;
