const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Review = sequelize.define('Review', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  author:    { type: DataTypes.STRING(100), allowNull: false },
  role:      { type: DataTypes.STRING(100), allowNull: true },
  text:      { type: DataTypes.TEXT, allowNull: false },
  rating:    { type: DataTypes.INTEGER, defaultValue: 5 },
  status:    { type: DataTypes.ENUM('pending', 'approved'), defaultValue: 'pending' },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, { tableName: 'Reviews', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

Review.sync({ alter: false }).catch(() => Review.sync().catch(e => console.error('[Review] sync error:', e.message)));

module.exports = Review;
