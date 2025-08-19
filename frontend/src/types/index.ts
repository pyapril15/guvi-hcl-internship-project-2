export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: Date;
  createdAt: Date;
}

export interface Message {
  id: string;
  sender: User;
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
  id: string;
  name?: string;
  type: 'private' | 'group';
  participants: User[];
  admin?: User;
  lastMessage?: Message;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  chatId?: string;
  userId?: string;
}

export interface TypingUser {
  userId: string;
  username: string;
  chatId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: string[];
}