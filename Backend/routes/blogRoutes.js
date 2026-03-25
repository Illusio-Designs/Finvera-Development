const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { authenticate } = require('../middleware/auth');

// Public routes
router.get('/', blogController.getAllBlogs);
router.get('/:slug', blogController.getBlogBySlug);

// Admin routes (protected)
router.get('/admin/all', authenticate, blogController.getAllBlogsAdmin);
router.post('/', authenticate, blogController.uploadBlogImage, blogController.createBlog);
router.put('/:id', authenticate, blogController.uploadBlogImage, blogController.updateBlog);
router.delete('/:id', authenticate, blogController.deleteBlog);

module.exports = router;
