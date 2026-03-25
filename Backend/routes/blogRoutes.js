const express = require('express');
const router = express.Router();

const placeholder = (req, res) => res.status(503).json({ success: false, message: 'Blog service initializing' });

let getAllBlogs = placeholder;
let getBlogBySlug = placeholder;
let getAllBlogsAdmin = placeholder;
let createBlog = placeholder;
let updateBlog = placeholder;
let deleteBlog = placeholder;
let uploadBlogImage = (req, res, next) => next();

try {
  const ctrl = require('../controllers/blogController');
  if (typeof ctrl.getAllBlogs === 'function') getAllBlogs = ctrl.getAllBlogs;
  if (typeof ctrl.getBlogBySlug === 'function') getBlogBySlug = ctrl.getBlogBySlug;
  if (typeof ctrl.getAllBlogsAdmin === 'function') getAllBlogsAdmin = ctrl.getAllBlogsAdmin;
  if (typeof ctrl.createBlog === 'function') createBlog = ctrl.createBlog;
  if (typeof ctrl.updateBlog === 'function') updateBlog = ctrl.updateBlog;
  if (typeof ctrl.deleteBlog === 'function') deleteBlog = ctrl.deleteBlog;
  if (typeof ctrl.uploadBlogImage === 'function') uploadBlogImage = ctrl.uploadBlogImage;
} catch (e) {
  console.error('[blogRoutes] Controller load error:', e.message);
}

let authenticate = (req, res, next) => next();
try {
  const auth = require('../middleware/auth');
  if (typeof auth.authenticate === 'function') authenticate = auth.authenticate;
} catch (e) {
  console.error('[blogRoutes] Auth middleware load error:', e.message);
}

// Admin routes BEFORE /:slug
router.get('/admin/all', authenticate, getAllBlogsAdmin);
router.post('/', authenticate, uploadBlogImage, createBlog);
router.put('/:id', authenticate, uploadBlogImage, updateBlog);
router.delete('/:id', authenticate, deleteBlog);

// Public routes
router.get('/', getAllBlogs);
router.get('/:slug', getBlogBySlug);

module.exports = router;
