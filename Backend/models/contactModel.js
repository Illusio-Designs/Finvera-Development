const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const ContactInquiry = sequelize.define('ContactInquiry', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  first_name: { type: DataTypes.STRING(100), allowNull: false },
  last_name:  { type: DataTypes.STRING(100), allowNull: true },
  email:      { type: DataTypes.STRING(255), allowNull: false },
  phone:      { type: DataTypes.STRING(20),  allowNull: false },
  message:    { type: DataTypes.TEXT,        allowNull: true },
  status:     { type: DataTypes.ENUM('new', 'read', 'replied'), defaultValue: 'new' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'ContactInquiries', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const NewsletterSubscriber = sequelize.define('NewsletterSubscriber', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email:      { type: DataTypes.STRING(255), allowNull: false, unique: true },
  status:     { type: DataTypes.ENUM('active', 'unsubscribed'), defaultValue: 'active' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'NewsletterSubscribers', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// Auto-create tables
ContactInquiry.sync({ alter: false }).catch(() => ContactInquiry.sync().catch(e => console.error('[ContactInquiry] sync error:', e.message)));
NewsletterSubscriber.sync({ alter: false }).catch(() => NewsletterSubscriber.sync().catch(e => console.error('[NewsletterSubscriber] sync error:', e.message)));

module.exports = { ContactInquiry, NewsletterSubscriber };
