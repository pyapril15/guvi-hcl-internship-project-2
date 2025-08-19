export interface User {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
}

export interface Message {
  _id: string;
  sender: string | User;
  chat: string;
  content: string;
  messageType: 'text' | 'image' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  isEdited: boolean;
  editedAt?: Date;
  readBy: ReadReceipt[];
  createdAt: Date;
}

export interface ReadReceipt {
  user: string;
  readAt: Date;
}

export interface Chat {
  _id: string;
  name?: string;
  type: 'private' | 'group';
  participants: (string | User)[];
  admin?: string | User;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketMessage {
  type: 'message' | 'typing_start' | 'typing_stop' | 'user_online' | 'user_offline' | 'message_read';
  payload: any;
  chatId?: string;
  userId?: string;
}

export interface AuthRequest extends Request {
  user?: User;
}

export interface TypingUser {
  userId: string;
  username: string;
  chatId: string;
  timestamp: number;
}

export interface ConnectedUser {
  userId: string;
  username: string;
  socketId: string;
  lastSeen: Date;
}