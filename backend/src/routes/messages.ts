import express from 'express';
import Message from '../models/Message';
import Chat from '../models/Chat';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get messages for a chat
router.get('/chat/:chatId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { chatId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user?._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const messages = await Message.find({ chat: chatId })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const totalMessages = await Message.countDocuments({ chat: chatId });
    const hasMore = totalMessages > pageNum * limitNum;

    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Reverse to get chronological order
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalMessages,
          hasMore
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Send a message
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { chatId, content, messageType = 'text', fileUrl, fileName, fileSize } = req.body;

    if (!chatId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Chat ID and content are required'
      });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user?._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Create message
    const message = new Message({
      sender: req.user?._id,
      chat: chatId,
      content,
      messageType,
      ...(fileUrl && { fileUrl }),
      ...(fileName && { fileName }),
      ...(fileSize && { fileSize })
    });

    await message.save();

    // Update chat's last message
    chat.lastMessage = message._id;
    await chat.save();

    // Populate message
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: { message: populatedMessage }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Edit message
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user?._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    // Only allow editing within 15 minutes
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > fifteenMinutes) {
      return res.status(400).json({
        success: false,
        message: 'Message can only be edited within 15 minutes of sending'
      });
    }

    message.content = content;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username avatar');

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: { message: populatedMessage }
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete message
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user?._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or not authorized'
      });
    }

    await Message.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Mark message as read
router.post('/:id/read', authenticate, async (req: AuthRequest, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if user is participant in the chat
    const chat = await Chat.findOne({
      _id: message.chat,
      participants: req.user?._id
    });

    if (!chat) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to read this message'
      });
    }

    // Check if already read by this user
    const alreadyRead = message.readBy.some(
      receipt => receipt.user.toString() === req.user?._id.toString()
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: req.user!._id,
        readAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;