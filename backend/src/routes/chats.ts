import express from 'express';
import Chat from '../models/Chat';
import Message from '../models/Message';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get user's chats
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user?._id
    })
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('admin', 'username email avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username avatar'
        }
      })
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: { chats }
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create new chat
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { participantIds, name, type = 'private' } = req.body;

    if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Participant IDs are required'
      });
    }

    // Add current user to participants if not included
    const allParticipants = [...new Set([req.user?._id.toString(), ...participantIds])];

    // Validate participants exist
    const users = await User.find({ _id: { $in: allParticipants } });
    if (users.length !== allParticipants.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more participants not found'
      });
    }

    // Check if private chat already exists
    if (type === 'private' && allParticipants.length === 2) {
      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: allParticipants, $size: 2 }
      });

      if (existingChat) {
        return res.status(400).json({
          success: false,
          message: 'Private chat already exists between these users'
        });
      }
    }

    // Create chat
    const chat = new Chat({
      name: type === 'group' ? name : undefined,
      type,
      participants: allParticipants,
      admin: type === 'group' ? req.user?._id : undefined
    });

    await chat.save();

    // Populate and return
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('admin', 'username email avatar');

    res.status(201).json({
      success: true,
      message: 'Chat created successfully',
      data: { chat: populatedChat }
    });
  } catch (error) {
    console.error('Create chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get chat by ID
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user?._id
    })
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('admin', 'username email avatar');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    res.json({
      success: true,
      data: { chat }
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update chat (only for group chats)
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, participantIds } = req.body;
    
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user?._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    if (chat.type === 'private') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update private chats'
      });
    }

    // Only admin can update group chat
    if (chat.admin?.toString() !== req.user?._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can update group chat'
      });
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (participantIds) updateData.participants = [...new Set(participantIds)];

    const updatedChat = await Chat.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('participants', 'username email avatar isOnline lastSeen')
      .populate('admin', 'username email avatar');

    res.json({
      success: true,
      message: 'Chat updated successfully',
      data: { chat: updatedChat }
    });
  } catch (error) {
    console.error('Update chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Delete chat
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user?._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // For group chats, only admin can delete
    if (chat.type === 'group' && chat.admin?.toString() !== req.user?._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only admin can delete group chat'
      });
    }

    // Delete all messages in the chat
    await Message.deleteMany({ chat: chat._id });
    
    // Delete the chat
    await Chat.findByIdAndDelete(chat._id);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;