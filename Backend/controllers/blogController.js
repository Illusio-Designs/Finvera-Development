const { Blog } = require('../models');
const { Op } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure Blogs table exists (handles live servers where setup is skipped)
Blog.sync({ alter: false }).catch(() => {
  console.log('[Blog] Table not found, creating...');
  Blog.sync().catch(e => console.error('[Blog] Failed to create table:', e.message));
});

// Multer config for blog cover images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'blog_images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `blog-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

exports.uploadBlogImage = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single('cover_image');

// Helper: generate slug from title
const generateSlug = (title) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// GET /api/blogs — public, paginated
exports.getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const { category, search } = req.query;

    const where = { status: 'published' };
    if (category) where.category = category;
    if (search) where.title = { [Op.like]: `%${search}%` };

    const { count, rows } = await Blog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
      attributes: ['blog_id', 'title', 'slug', 'excerpt', 'cover_image', 'category', 'author', 'views', 'created_at']
    });

    res.json({
      success: true,
      blogs: rows,
      currentPage: page,
      totalPages: Math.ceil(count / limit),
      totalItems: count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/blogs/:slug — public, single post
exports.getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ where: { slug: req.params.slug, status: 'published' } });
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    // increment views
    await blog.increment('views');

    // recent posts for sidebar
    const recent = await Blog.findAll({
      where: { status: 'published', blog_id: { [Op.ne]: blog.blog_id } },
      order: [['created_at', 'DESC']],
      limit: 4,
      attributes: ['blog_id', 'title', 'slug', 'cover_image', 'created_at']
    });

    res.json({ success: true, blog, recentPosts: recent });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/blogs/admin/all — admin, all posts
exports.getAllBlogsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { count, rows } = await Blog.findAndCountAll({
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    res.json({ success: true, blogs: rows, currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/blogs — admin create
exports.createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, category, tags, author, status } = req.body;
    if (!title || !content) return res.status(400).json({ success: false, message: 'Title and content are required' });

    let slug = generateSlug(title);
    // ensure unique slug
    const existing = await Blog.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const cover_image = req.file ? `/uploads/blog_images/${req.file.filename}` : null;

    const parseTags = (tags) => {
      if (!tags) return [];
      if (Array.isArray(tags)) return tags;
      // comma-separated string like "compliance, esic"
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    };

    const blog = await Blog.create({
      title, slug, excerpt, content, cover_image,
      category: category || 'General',
      tags: parseTags(tags),
      author: author || 'Radhe Consultancy',
      status: status || 'published'
    });

    res.status(201).json({ success: true, blog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/blogs/:id — admin update
exports.updateBlog = async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    const { title, excerpt, content, category, tags, author, status } = req.body;
    const cover_image = req.file ? `/uploads/blog_images/${req.file.filename}` : blog.cover_image;

    let slug = blog.slug;
    if (title && title !== blog.title) {
      slug = generateSlug(title);
      const existing = await Blog.findOne({ where: { slug, blog_id: { [Op.ne]: blog.blog_id } } });
      if (existing) slug = `${slug}-${Date.now()}`;
    }

    const parseTags = (tags) => {
      if (!tags) return [];
      if (Array.isArray(tags)) return tags;
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    };

    await blog.update({
      title: title || blog.title,
      slug,
      excerpt: excerpt !== undefined ? excerpt : blog.excerpt,
      content: content || blog.content,
      cover_image,
      category: category || blog.category,
      tags: parseTags(tags) || blog.tags,
      author: author || blog.author,
      status: status || blog.status
    });

    res.json({ success: true, blog });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/blogs/:id — admin delete
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findByPk(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });
    await blog.destroy();
    res.json({ success: true, message: 'Blog deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
