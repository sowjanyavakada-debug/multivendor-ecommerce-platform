const db = require('../database/database');

// 1. Get user notifications
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;

    const notifications = await db.all(
      'SELECT * FROM Notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );

    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
};

// 2. Mark a single notification as read
const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Check if notification exists and belongs to user
    const notification = await db.get(
      'SELECT id FROM Notifications WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.'
      });
    }

    await db.run(
      'UPDATE Notifications SET is_read = 1 WHERE id = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

// 3. Mark all user notifications as read
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await db.run(
      'UPDATE Notifications SET is_read = 1 WHERE user_id = ?',
      [userId]
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
