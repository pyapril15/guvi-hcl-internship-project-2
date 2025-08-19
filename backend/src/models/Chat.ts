import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChat extends Document {
  name?: string;
  type: 'private' | 'group';
  participants: Types.ObjectId[];
  admin?: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>({
  name: {
    type: String,
    trim: true,
    maxlength: [50, 'Chat name cannot exceed 50 characters']
  },
  type: {
    type: String,
    enum: ['private', 'group'],
    required: [true, 'Chat type is required'],
    default: 'private'
  },
  participants: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  admin: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  lastMessage: {
    type: Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better performance
chatSchema.index({ participants: 1 });
chatSchema.index({ type: 1 });
chatSchema.index({ updatedAt: -1 });

// Validate participants
chatSchema.pre('save', function(next) {
  if (this.type === 'private' && this.participants.length !== 2) {
    return next(new Error('Private chat must have exactly 2 participants'));
  }
  
  if (this.type === 'group' && this.participants.length < 2) {
    return next(new Error('Group chat must have at least 2 participants'));
  }
  
  // Set admin for group chats
  if (this.type === 'group' && !this.admin) {
    this.admin = this.participants[0];
  }
  
  next();
});

export default mongoose.model<IChat>('Chat', chatSchema);