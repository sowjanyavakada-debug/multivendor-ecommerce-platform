const db = require('../database/database');

// 1. Send Message
const sendMessage = async (req, res, next) => {
  try {
    const senderId = req.user.id;
    const senderRole = req.user.role;
    const { receiver_id, receiver_role, message, order_id } = req.body;

    if (!receiver_id || !receiver_role || !message) {
      return res.status(400).json({ success: false, message: 'receiver_id, receiver_role, and message are required.' });
    }

    const result = await db.run(
      `INSERT INTO Messages (sender_id, sender_role, receiver_id, receiver_role, message, order_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [senderId, senderRole, receiver_id, receiver_role, message, order_id || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: {
        id: result.id,
        sender_id: senderId,
        sender_role: senderRole,
        receiver_id,
        receiver_role,
        message,
        order_id: order_id || null,
        created_at: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Threads/Chats list
const getChats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch unique user threads interacting with the current user
    let sql = '';
    if (userRole === 'admin') {
      sql = `
        SELECT DISTINCT sender_id as other_id, sender_role as other_role, 'Customer' as other_name
        FROM Messages 
        WHERE receiver_role = 'admin'
        UNION
        SELECT DISTINCT receiver_id as other_id, receiver_role as other_role, 'Customer' as other_name
        FROM Messages
        WHERE sender_role = 'admin'
      `;
    } else if (userRole === 'vendor') {
      sql = `
        SELECT DISTINCT m.sender_id as other_id, m.sender_role as other_role, u.name as other_name
        FROM Messages m
        JOIN Users u ON m.sender_id = u.id
        WHERE m.receiver_id = ? AND m.receiver_role = 'vendor'
        UNION
        SELECT DISTINCT m.receiver_id as other_id, m.receiver_role as other_role, u.name as other_name
        FROM Messages m
        JOIN Users u ON m.receiver_id = u.id
        WHERE m.sender_id = ? AND m.sender_role = 'vendor'
      `;
    } else {
      // Customer
      sql = `
        SELECT DISTINCT m.receiver_id as other_id, m.receiver_role as other_role, 
               CASE WHEN m.receiver_role = 'admin' THEN 'ShopHub Support' ELSE v.vendor_name END as other_name
        FROM Messages m
        LEFT JOIN Vendors v ON m.receiver_id = v.id AND m.receiver_role = 'vendor'
        WHERE m.sender_id = ? AND m.sender_role = 'user'
        UNION
        SELECT DISTINCT m.sender_id as other_id, m.sender_role as other_role,
               CASE WHEN m.sender_role = 'admin' THEN 'ShopHub Support' ELSE v.vendor_name END as other_name
        FROM Messages m
        LEFT JOIN Vendors v ON m.sender_id = v.id AND m.sender_role = 'vendor'
        WHERE m.receiver_id = ? AND m.receiver_role = 'user'
      `;
    }

    const params = userRole === 'admin' ? [] : [userId, userId];
    const chats = await db.all(sql, params);

    // Fetch last message for each chat
    for (const chat of chats) {
      // Find the last message between user and other_user
      let lastMsgSql = '';
      let lastMsgParams = [];

      if (userRole === 'admin') {
        lastMsgSql = `
          SELECT message, created_at FROM Messages 
          WHERE (sender_role = 'admin' AND receiver_id = ? AND receiver_role = ?)
             OR (receiver_role = 'admin' AND sender_id = ? AND sender_role = ?)
          ORDER BY created_at DESC LIMIT 1
        `;
        lastMsgParams = [chat.other_id, chat.other_role, chat.other_id, chat.other_role];
      } else {
        lastMsgSql = `
          SELECT message, created_at FROM Messages 
          WHERE (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ?)
             OR (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ?)
          ORDER BY created_at DESC LIMIT 1
        `;
        lastMsgParams = [
          userId, userRole, chat.other_id, chat.other_role,
          chat.other_id, chat.other_role, userId, userRole
        ];
      }

      const lastMsg = await db.get(lastMsgSql, lastMsgParams);
      chat.lastMessage = lastMsg ? lastMsg.message : '';
      chat.lastTimestamp = lastMsg ? lastMsg.created_at : null;
    }

    // Sort by last message timestamp desc
    chats.sort((a, b) => new Date(b.lastTimestamp || 0) - new Date(a.lastTimestamp || 0));

    return res.status(200).json({ success: true, data: chats });
  } catch (error) {
    next(error);
  }
};

// 3. Get Chat History
const getChatHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { other_id, other_role, order_id } = req.query;

    if (!other_id || !other_role) {
      return res.status(400).json({ success: false, message: 'other_id and other_role are required query parameters.' });
    }

    let sql = '';
    let params = [];

    if (userRole === 'admin') {
      sql = `
        SELECT * FROM Messages 
        WHERE (sender_role = 'admin' AND receiver_id = ? AND receiver_role = ?)
           OR (receiver_role = 'admin' AND sender_id = ? AND sender_role = ?)
        ORDER BY created_at ASC
      `;
      params = [other_id, other_role, other_id, other_role];
    } else {
      sql = `
        SELECT * FROM Messages 
        WHERE (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ?)
           OR (sender_id = ? AND sender_role = ? AND receiver_id = ? AND receiver_role = ?)
        ORDER BY created_at ASC
      `;
      params = [
        userId, userRole, other_id, other_role,
        other_id, other_role, userId, userRole
      ];
    }

    const messages = await db.all(sql, params);

    return res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getChats,
  getChatHistory,
};
