import { Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Chat from '../models/Chat';
import Message from '../models/Message';
import { ConnectedUser, TypingUser, WebSocketMessage } from '../types';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocket.Server;
  private connectedUsers = new Map<string, ExtendedWebSocket>();
  private typingUsers = new Map<string, TypingUser>();

  constructor(server: Server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });

    this.setupWebSocket();
    this.setupHeartbeat();
  }

  private setupWebSocket(): void {
    this.wss.on('connection', async (ws: ExtendedWebSocket, req) => {
      try {
        // Extract token from query parameters or headers
        const url = new URL(req.url!, `http://${req.headers.host}`);
        const token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];

        if (!token) {
          ws.close(4001, 'Unauthorized: No token provided');
          return;
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        const user = await User.findById(decoded.userId);

        if (!user) {
          ws.close(4002, 'Unauthorized: Invalid token');
          return;
        }

        // Setup WebSocket connection
        ws.userId = user._id.toString();
        ws.username = user.username;
        ws.isAlive = true;

        // Store connection
        this.connectedUsers.set(user._id.toString(), ws);

        // Update user online status
        user.isOnline = true;
        user.lastSeen = new Date();
        await user.save();

        console.log(`🟢 User ${user.username} connected via WebSocket`);

        // Broadcast user online status
        this.broadcastToUserChats(user._id.toString(), {
          type: 'user_online',
          payload: {
            userId: user._id.toString(),
            username: user.username,
            timestamp: new Date()
          }
        });

        // Handle incoming messages
        ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(ws, data);
        });

        // Handle connection close
        ws.on('close', async () => {
          await this.handleDisconnection(ws);
        });

        // Handle connection errors
        ws.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        // Setup ping/pong for connection health
        ws.on('pong', () => {
          ws.isAlive = true;
        });

        // Send welcome message
        this.sendToClient(ws, {
          type: 'connection',
          payload: {
            message: 'Connected successfully',
            userId: user._id.toString(),
            timestamp: new Date()
          }
        });

      } catch (error) {
        console.error('WebSocket connection error:', error);
        ws.close(4003, 'Internal server error');
      }
    });
  }

  private async handleMessage(ws: ExtendedWebSocket, data: WebSocket.Data): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'join_room':
          await this.handleJoinRoom(ws, message);
          break;

        case 'leave_room':
          await this.handleLeaveRoom(ws, message);
          break;

        case 'send_message':
          await this.handleSendMessage(ws, message);
          break;

        case 'typing_start':
          await this.handleTypingStart(ws, message);
          break;

        case 'typing_stop':
          await this.handleTypingStop(ws, message);
          break;

        case 'message_read':
          await this.handleMessageRead(ws, message);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: {
          message: 'Error processing message',
          timestamp: new Date()
        }
      });
    }
  }

  private async handleJoinRoom(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { chatId } = message.payload;

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: chatId,
      participants: ws.userId
    });

    if (!chat) {
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Chat not found or access denied' }
      });
      return;
    }

    // Send confirmation
    this.sendToClient(ws, {
      type: 'room_joined',
      payload: { chatId, timestamp: new Date() }
    });
  }

  private async handleLeaveRoom(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { chatId } = message.payload;

    // Remove user from typing if they were typing
    this.typingUsers.delete(`${ws.userId}-${chatId}`);

    this.sendToClient(ws, {
      type: 'room_left',
      payload: { chatId, timestamp: new Date() }
    });
  }

  private async handleSendMessage(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { chatId, content, messageType = 'text', fileUrl, fileName, fileSize } = message.payload;

    try {
      // Verify user is participant in the chat
      const chat = await Chat.findOne({
        _id: chatId,
        participants: ws.userId
      });

      if (!chat) {
        this.sendToClient(ws, {
          type: 'error',
          payload: { message: 'Chat not found or access denied' }
        });
        return;
      }

      // Create and save message
      const newMessage = new Message({
        sender: ws.userId,
        chat: chatId,
        content,
        messageType,
        ...(fileUrl && { fileUrl }),
        ...(fileName && { fileName }),
        ...(fileSize && { fileSize })
      });

      await newMessage.save();

      // Update chat's last message
      chat.lastMessage = newMessage._id;
      await chat.save();

      // Populate message
      const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', 'username avatar');

      // Broadcast to all participants
      this.broadcastToChat(chatId, {
        type: 'new_message',
        payload: {
          message: populatedMessage,
          chatId,
          timestamp: new Date()
        }
      });

      // Remove typing indicator if user was typing
      this.typingUsers.delete(`${ws.userId}-${chatId}`);
      this.broadcastToChat(chatId, {
        type: 'typing_stop',
        payload: {
          userId: ws.userId,
          username: ws.username,
          chatId,
          timestamp: new Date()
        }
      }, ws.userId);

    } catch (error) {
      console.error('Error sending message:', error);
      this.sendToClient(ws, {
        type: 'error',
        payload: { message: 'Failed to send message' }
      });
    }
  }

  private async handleTypingStart(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { chatId } = message.payload;
    const typingKey = `${ws.userId}-${chatId}`;

    // Store typing user
    this.typingUsers.set(typingKey, {
      userId: ws.userId!,
      username: ws.username!,
      chatId,
      timestamp: Date.now()
    });

    // Broadcast to other participants
    this.broadcastToChat(chatId, {
      type: 'typing_start',
      payload: {
        userId: ws.userId,
        username: ws.username,
        chatId,
        timestamp: new Date()
      }
    }, ws.userId);

    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      if (this.typingUsers.has(typingKey)) {
        this.typingUsers.delete(typingKey);
        this.broadcastToChat(chatId, {
          type: 'typing_stop',
          payload: {
            userId: ws.userId,
            username: ws.username,
            chatId,
            timestamp: new Date()
          }
        }, ws.userId);
      }
    }, 3000);
  }

  private async handleTypingStop(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { chatId } = message.payload;
    const typingKey = `${ws.userId}-${chatId}`;

    this.typingUsers.delete(typingKey);

    this.broadcastToChat(chatId, {
      type: 'typing_stop',
      payload: {
        userId: ws.userId,
        username: ws.username,
        chatId,
        timestamp: new Date()
      }
    }, ws.userId);
  }

  private async handleMessageRead(ws: ExtendedWebSocket, message: WebSocketMessage): Promise<void> {
    const { messageId, chatId } = message.payload;

    try {
      const messageDoc = await Message.findById(messageId);
      if (!messageDoc) return;

      // Check if already read by this user
      const alreadyRead = messageDoc.readBy.some(
        receipt => receipt.user.toString() === ws.userId
      );

      if (!alreadyRead) {
        messageDoc.readBy.push({
          user: ws.userId as any,
          readAt: new Date()
        });
        await messageDoc.save();
      }

      // Broadcast read receipt
      this.broadcastToChat(chatId, {
        type: 'message_read',
        payload: {
          messageId,
          chatId,
          userId: ws.userId,
          username: ws.username,
          timestamp: new Date()
        }
      });

    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }

  private async handleDisconnection(ws: ExtendedWebSocket): Promise<void> {
    if (ws.userId) {
      console.log(`🔴 User ${ws.username} disconnected from WebSocket`);

      // Remove from connected users
      this.connectedUsers.delete(ws.userId);

      // Remove from typing users
      for (const [key, typingUser] of this.typingUsers.entries()) {
        if (typingUser.userId === ws.userId) {
          this.typingUsers.delete(key);
        }
      }

      // Update user offline status
      try {
        await User.findByIdAndUpdate(ws.userId, {
          isOnline: false,
          lastSeen: new Date()
        });

        // Broadcast user offline status
        this.broadcastToUserChats(ws.userId, {
          type: 'user_offline',
          payload: {
            userId: ws.userId,
            username: ws.username,
            timestamp: new Date()
          }
        });
      } catch (error) {
        console.error('Error updating user offline status:', error);
      }
    }
  }

  private sendToClient(ws: ExtendedWebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private async broadcastToChat(chatId: string, message: WebSocketMessage, excludeUserId?: string): Promise<void> {
    try {
      const chat = await Chat.findById(chatId).populate('participants', '_id');
      if (!chat) return;

      chat.participants.forEach((participant: any) => {
        const userId = participant._id.toString();
        if (userId === excludeUserId) return;

        const userWs = this.connectedUsers.get(userId);
        if (userWs) {
          this.sendToClient(userWs, message);
        }
      });
    } catch (error) {
      console.error('Error broadcasting to chat:', error);
    }
  }

  private async broadcastToUserChats(userId: string, message: WebSocketMessage): Promise<void> {
    try {
      const chats = await Chat.find({ participants: userId }).populate('participants', '_id');
      
      const notifiedUsers = new Set<string>();

      chats.forEach(chat => {
        chat.participants.forEach((participant: any) => {
          const participantId = participant._id.toString();
          if (participantId === userId || notifiedUsers.has(participantId)) return;

          notifiedUsers.add(participantId);
          const userWs = this.connectedUsers.get(participantId);
          if (userWs) {
            this.sendToClient(userWs, message);
          }
        });
      });
    } catch (error) {
      console.error('Error broadcasting to user chats:', error);
    }
  }

  private setupHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) {
          console.log('Terminating inactive WebSocket connection');
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // Check every 30 seconds
  }

  public getConnectedUsers(): ConnectedUser[] {
    const users: ConnectedUser[] = [];
    this.connectedUsers.forEach((ws, userId) => {
      users.push({
        userId,
        username: ws.username!,
        socketId: ws.toString(),
        lastSeen: new Date()
      });
    });
    return users;
  }

  public getOnlineCount(): number {
    return this.connectedUsers.size;
  }
}

let wsManager: WebSocketManager;

export const setupWebSocket = (server: Server): WebSocketManager => {
  wsManager = new WebSocketManager(server);
  return wsManager;
};

export const getWebSocketManager = (): WebSocketManager => {
  return wsManager;
};