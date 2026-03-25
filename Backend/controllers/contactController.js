const { ContactInquiry, NewsletterSubscriber } = require('../models/contactModel');

// POST /api/contact
exports.submitContact = async (req, res) => {
  try {
    const { firstName, lastName, phone, email, message } = req.body;
    if (!firstName || !email || !phone)
      return res.status(400).json({ success: false, message: 'First name, email and phone are required' });

    await ContactInquiry.create({ first_name: firstName, last_name: lastName || '', email, phone, message: message || '' });

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (err) {
    console.error('[Contact]', err.message);
    res.status(500).json({ success: false, message: 'Failed to send message. Please try again.' });
  }
};

// POST /api/contact/newsletter
exports.subscribeNewsletter = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@'))
      return res.status(400).json({ success: false, message: 'Valid email is required' });

    const [sub, created] = await NewsletterSubscriber.findOrCreate({ where: { email }, defaults: { email, status: 'active' } });
    if (!created && sub.status === 'active')
      return res.json({ success: true, message: 'Already subscribed!' });
    if (!created) await sub.update({ status: 'active' });

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (err) {
    console.error('[Newsletter]', err.message);
    res.status(500).json({ success: false, message: 'Failed to subscribe. Please try again.' });
  }
};

// GET /api/contact/inquiries — admin
exports.getInquiries = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { count, rows } = await ContactInquiry.findAndCountAll({
      order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit
    });
    res.json({ success: true, inquiries: rows, currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PATCH /api/contact/inquiries/:id/status — admin
exports.updateInquiryStatus = async (req, res) => {
  try {
    const inq = await ContactInquiry.findByPk(req.params.id);
    if (!inq) return res.status(404).json({ success: false, message: 'Not found' });
    await inq.update({ status: req.body.status });
    res.json({ success: true, inquiry: inq });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/contact/inquiries/:id — admin
exports.deleteInquiry = async (req, res) => {
  try {
    const inq = await ContactInquiry.findByPk(req.params.id);
    if (!inq) return res.status(404).json({ success: false, message: 'Not found' });
    await inq.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/contact/subscribers — admin
exports.getSubscribers = async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { count, rows } = await NewsletterSubscriber.findAndCountAll({
      order: [['created_at', 'DESC']], limit, offset: (page - 1) * limit
    });
    res.json({ success: true, subscribers: rows, currentPage: page, totalPages: Math.ceil(count / limit), totalItems: count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE /api/contact/subscribers/:id — admin
exports.deleteSubscriber = async (req, res) => {
  try {
    const sub = await NewsletterSubscriber.findByPk(req.params.id);
    if (!sub) return res.status(404).json({ success: false, message: 'Not found' });
    await sub.destroy();
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
