import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReadReceipt {
  user: Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  sender: Types.ObjectId;
  chat: Types.ObjectId;
  content: string;
  messageType: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isEdited: boolean;
  editedAt?: Date;
  readBy: IReadReceipt[];
  createdAt: Date;
  updatedAt: Date;
}

const readReceiptSchema = new Schema<IReadReceipt>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  readAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  chat: {
    type: Schema.Types.ObjectId,
    ref: 'Chat',
    required: [true, 'Chat is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    trim: true,
    maxlength: [2000, 'Message content cannot exceed 2000 characters']
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text'
  },
  fileUrl: {
    type: String
  },
  fileName: {
    type: String
  },
  fileSize: {
    type: Number
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  readBy: [readReceiptSchema]
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
messageSchema.index({ chat: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ createdAt: -1 });

export default mongoose.model<IMessage>('Message', messageSchema);