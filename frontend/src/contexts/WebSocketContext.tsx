import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { websocketService } from '@/services/websocket';
import { useAuth } from './AuthContext';
import { Message, TypingUser } from '@/types';

interface WebSocketContextType {
  isConnected: boolean;
  onlineUsers: string[];
  typingUsers: TypingUser[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  joinRoom: (chatId: string) => void;
  leaveRoom: (chatId: string) => void;
  sendMessage: (chatId: string, content: string, messageType?: string) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  markMessageAsRead: (messageId: string, chatId: string) => void;
  onNewMessage: (handler: (message: Message) => void) => () => void;
  onUserOnline: (handler: (data: { userId: string; username: string }) => void) => () => void;
  onUserOffline: (handler: (data: { userId: string; username: string }) => void) => () => void;
  onTypingStart: (handler: (data: TypingUser) => void) => () => void;
  onTypingStop: (handler: (data: TypingUser) => void) => () => void;
  onMessageRead: (handler: (data: { messageId: string; userId: string; username: string; chatId: string }) => void) => () => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated, user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const connectionRef = useRef<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  // Clear typing timeout for users
  const clearTypingTimeout = useCallback((userId: string, chatId: string) => {
    setTimeout(() => {
      setTypingUsers(prev =>
          prev.filter(t => !(t.userId === userId && t.chatId === chatId))
      );
    }, 3000); // Clear typing after 3 seconds of inactivity
  }, []);

  // Setup WebSocket connection
  const setupConnection = useCallback(async () => {
    if (!isAuthenticated || !token || connectionRef.current) return;

    try {
      setConnectionStatus('connecting');
      console.log('Attempting WebSocket connection...');
      connectionRef.current = true;

      await websocketService.connect(token);
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttempts.current = 0;

      console.log('WebSocket connected successfully');

      // Setup event handlers
      websocketService.on('connection', (data) => {
        console.log('WebSocket connection confirmed:', data);
        if (data.onlineUsers) {
          setOnlineUsers(data.onlineUsers);
        }
      });

      websocketService.on('user_online', (data) => {
        console.log('User came online:', data);
        setOnlineUsers(prev => {
          if (!prev.includes(data.userId)) {
            return [...prev, data.userId];
          }
          return prev;
        });
      });

      websocketService.on('user_offline', (data) => {
        console.log('User went offline:', data);
        setOnlineUsers(prev => prev.filter(id => id !== data.userId));
        // Remove typing indicators for offline users
        setTypingUsers(prev => prev.filter(t => t.userId !== data.userId));
      });

      websocketService.on('typing_start', (data) => {
        console.log('User started typing:', data);
        setTypingUsers(prev => {
          const existing = prev.find(t => t.userId === data.userId && t.chatId === data.chatId);
          if (!existing) {
            clearTypingTimeout(data.userId, data.chatId);
            return [...prev, data];
          }
          return prev;
        });
      });

      websocketService.on('typing_stop', (data) => {
        console.log('User stopped typing:', data);
        setTypingUsers(prev =>
            prev.filter(t => !(t.userId === data.userId && t.chatId === data.chatId))
        );
      });

      websocketService.on('new_message', (data) => {
        console.log('New message received via WebSocket:', data);
        // Remove typing indicator for message sender
        setTypingUsers(prev =>
            prev.filter(t => !(t.userId === data.message.sender.id && t.chatId === data.message.chatId))
        );
      });

      websocketService.on('error', (data) => {
        console.error('WebSocket error:', data);
        setConnectionStatus('error');
      });

      websocketService.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        connectionRef.current = false;

        // Clear online users and typing indicators on disconnect
        setOnlineUsers([]);
        setTypingUsers([]);

        // Attempt reconnection
        if (isAuthenticated && reconnectAttempts.current < maxReconnectAttempts) {
          const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            setupConnection();
          }, delay);
        }
      });

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('error');
      connectionRef.current = false;

      // Attempt reconnection on error
      if (isAuthenticated && reconnectAttempts.current < maxReconnectAttempts) {
        const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          setupConnection();
        }, delay);
      }
    }
  }, [isAuthenticated, token, clearTypingTimeout]);

  // Manual reconnect function
  const reconnect = useCallback(() => {
    if (connectionRef.current) {
      websocketService.disconnect();
      connectionRef.current = false;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    reconnectAttempts.current = 0;
    setupConnection();
  }, [setupConnection]);

  // Handle authentication changes
  useEffect(() => {
    if (isAuthenticated && token && user) {
      console.log('User authenticated, setting up WebSocket connection');
      setupConnection();
    } else if (!isAuthenticated && connectionRef.current) {
      console.log('User logged out, disconnecting WebSocket');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      websocketService.disconnect();
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setOnlineUsers([]);
      setTypingUsers([]);
      connectionRef.current = false;
      reconnectAttempts.current = 0;
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, token, user, setupConnection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        websocketService.disconnect();
        connectionRef.current = false;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const joinRoom = useCallback((chatId: string) => {
    if (isConnected) {
      console.log(`Joining room: ${chatId}`);
      websocketService.joinRoom(chatId);
    }
  }, [isConnected]);

  const leaveRoom = useCallback((chatId: string) => {
    if (isConnected) {
      console.log(`Leaving room: ${chatId}`);
      websocketService.leaveRoom(chatId);
      // Clear typing indicators for this chat
      setTypingUsers(prev => prev.filter(t => t.chatId !== chatId));
    }
  }, [isConnected]);

  const sendMessage = useCallback((chatId: string, content: string, messageType = 'text') => {
    if (isConnected) {
      websocketService.sendMessage(chatId, content, messageType);
    }
  }, [isConnected]);

  const startTyping = useCallback((chatId: string) => {
    if (isConnected) {
      websocketService.startTyping(chatId);
    }
  }, [isConnected]);

  const stopTyping = useCallback((chatId: string) => {
    if (isConnected) {
      websocketService.stopTyping(chatId);
    }
  }, [isConnected]);

  const markMessageAsRead = useCallback((messageId: string, chatId: string) => {
    if (isConnected) {
      websocketService.markMessageAsRead(messageId, chatId);
    }
  }, [isConnected]);

  const onNewMessage = useCallback((handler: (message: Message) => void) => {
    const wrappedHandler = (data: any) => handler(data.message || data);
    websocketService.on('new_message', wrappedHandler);
    return () => websocketService.off('new_message', wrappedHandler);
  }, []);

  const onUserOnline = useCallback((handler: (data: { userId: string; username: string }) => void) => {
    websocketService.on('user_online', handler);
    return () => websocketService.off('user_online', handler);
  }, []);

  const onUserOffline = useCallback((handler: (data: { userId: string; username: string }) => void) => {
    websocketService.on('user_offline', handler);
    return () => websocketService.off('user_offline', handler);
  }, []);

  const onTypingStart = useCallback((handler: (data: TypingUser) => void) => {
    websocketService.on('typing_start', handler);
    return () => websocketService.off('typing_start', handler);
  }, []);

  const onTypingStop = useCallback((handler: (data: TypingUser) => void) => {
    websocketService.on('typing_stop', handler);
    return () => websocketService.off('typing_stop', handler);
  }, []);

  const onMessageRead = useCallback((handler: (data: { messageId: string; userId: string; username: string; chatId: string }) => void) => {
    websocketService.on('message_read', handler);
    return () => websocketService.off('message_read', handler);
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    connectionStatus,
    onlineUsers,
    typingUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageAsRead,
    onNewMessage,
    onUserOnline,
    onUserOffline,
    onTypingStart,
    onTypingStop,
    onMessageRead,
    reconnect,
  };

  return (
      <WebSocketContext.Provider value={value}>
        {children}
      </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};