import express from 'express';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all users (for finding people to chat with)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user?._id } })
      .select('username email avatar isOnline lastSeen createdAt')
      .sort({ isOnline: -1, username: 1 });

    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username email avatar isOnline lastSeen createdAt');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Update user profile
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { username, email, avatar } = req.body;

    // Check if user is updating their own profile
    if (req.user?._id.toString() !== id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile'
      });
    }

    // Check if username/email is already taken by another user
    if (username || email) {
      const existingUser = await User.findOne({
        $and: [
          { _id: { $ne: id } },
          { $or: [{ username }, { email }] }
        ]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username or email already taken'
        });
      }
    }

    const user = await User.findByIdAndUpdate(
      id,
      { ...(username && { username }), ...(email && { email }), ...(avatar && { avatar }) },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;