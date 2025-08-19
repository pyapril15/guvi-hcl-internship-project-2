import { useState, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, User } from '@/types';
import { apiService } from '@/services/api';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuth } from '@/contexts/AuthContext';

export const useChat = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [isInitialized, setIsInitialized] = useState(false);

  const { onNewMessage, joinRoom, leaveRoom, isConnected } = useWebSocket();
  const { isAuthenticated, user } = useAuth();
  const currentChatRef = useRef<Chat | null>(null);
  const messageHandlerRef = useRef<((message: Message) => void) | null>(null);

  // Keep ref updated
  useEffect(() => {
    currentChatRef.current = currentChat;
  }, [currentChat]);

  // Load chats with real-time updates
  const loadChats = useCallback(async (showLoading = true) => {
    if (!isAuthenticated || !user) return;

    try {
      if (showLoading) setIsLoading(true);
      console.log('Loading chats...');

      const response = await apiService.getChats();
      if (response.success && response.data) {
        // Sort chats by last message time or update time
        const sortedChats = response.data.chats.sort((a, b) => {
          const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.updatedAt).getTime();
          const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.updatedAt).getTime();
          return bTime - aTime;
        });

        setChats(sortedChats);
        setLastRefresh(Date.now());
        console.log('Chats loaded:', sortedChats.length);

        // Update current chat if it exists in the new data
        if (currentChatRef.current) {
          const updatedCurrentChat = sortedChats.find(c => c.id === currentChatRef.current?.id);
          if (updatedCurrentChat) {
            setCurrentChat(updatedCurrentChat);
          }
        }

        // Mark as initialized after first successful load
        if (!isInitialized) {
          setIsInitialized(true);
        }
      }
    } catch (error) {
      console.error('Error loading chats:', error);
      if (chats.length === 0) {
        setChats([]);
      }
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [isAuthenticated, user, chats.length, isInitialized]);

  // Load messages for a chat
  const loadMessages = useCallback(async (chatId: string, pageNum = 1, reset = false) => {
    if (isLoading || !isAuthenticated) return;

    setIsLoading(true);
    try {
      console.log(`Loading messages for chat ${chatId}, page ${pageNum}`);
      const response = await apiService.getMessages(chatId, pageNum);
      if (response.success && response.data) {
        if (reset) {
          setMessages(response.data.messages);
        } else {
          setMessages(prev => [...response.data.messages, ...prev]);
        }
        setHasMore(response.data.pagination.hasMore);
        setPage(pageNum);
        console.log(`Messages loaded: ${response.data.messages.length}`);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isAuthenticated]);

  // Create new chat
  const createChat = useCallback(async (participantIds: string[], name?: string, type: 'private' | 'group' = 'private') => {
    if (!isAuthenticated) return;

    try {
      const response = await apiService.createChat(participantIds, name, type);
      if (response.success && response.data) {
        // Add new chat to the beginning of the list
        setChats(prev => [response.data.chat, ...prev]);
        console.log('New chat created:', response.data.chat);
        return response.data.chat;
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  }, [isAuthenticated]);

  // Send message with optimistic updates
  const sendMessage = useCallback(async (chatId: string, content: string) => {
    if (!isAuthenticated || !user) return;

    try {
      console.log(`Sending message to chat ${chatId}`);
      const response = await apiService.sendMessage(chatId, content);
      if (response.success && response.data) {
        console.log('Message sent successfully:', response.data.message);

        // Immediately update local messages if this is the current chat
        if (currentChatRef.current && currentChatRef.current.id === chatId) {
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === response.data.message.id);
            if (!exists) {
              return [...prev, response.data.message];
            }
            return prev;
          });
        }

        // Update chat sidebar immediately
        updateChatLastMessage(response.data.message);

        return response.data.message;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }, [isAuthenticated, user]);

  // Load more messages
  const loadMoreMessages = useCallback(() => {
    if (currentChat && hasMore && !isLoading && isAuthenticated) {
      loadMessages(currentChat.id, page + 1);
    }
  }, [currentChat, hasMore, isLoading, page, loadMessages, isAuthenticated]);

  // Update chat's last message when new message arrives
  const updateChatLastMessage = useCallback((message: Message) => {
    console.log('Updating chat last message:', message);
    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat.id === message.chatId) {
          return {
            ...chat,
            lastMessage: message,
            updatedAt: new Date().toISOString()
          };
        }
        return chat;
      });

      // Re-sort chats by last message time
      const sortedChats = updatedChats.sort((a, b) => {
        const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : new Date(a.updatedAt).getTime();
        const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });

      return sortedChats;
    });
  }, []);

  // Set active chat
  const setActiveChat = useCallback((chat: Chat | null) => {
    console.log('Setting active chat:', chat?.id);

    if (currentChat && currentChat.id !== chat?.id) {
      leaveRoom(currentChat.id);
    }

    setCurrentChat(chat);

    if (chat && isAuthenticated) {
      joinRoom(chat.id);
      loadMessages(chat.id, 1, true);
    } else {
      setMessages([]);
      setPage(1);
      setHasMore(true);
    }
  }, [currentChat, joinRoom, leaveRoom, loadMessages, isAuthenticated]);

  // Setup WebSocket message handler
  useEffect(() => {
    if (!isConnected || !isAuthenticated) return;

    // Remove previous handler if exists
    if (messageHandlerRef.current) {
      const unsubscribe = onNewMessage(messageHandlerRef.current);
      unsubscribe();
    }

    // Create new handler
    const messageHandler = (message: Message) => {
      console.log('Received new message via WebSocket:', message);

      // Add message to current chat if it matches
      if (currentChatRef.current && currentChatRef.current.id === message.chatId) {
        setMessages(prev => {
          // Avoid duplicates
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) return prev;
          console.log('Adding message to current chat');
          return [...prev, message];
        });
      }

      // Always update chat's last message in sidebar
      updateChatLastMessage(message);
    };

    messageHandlerRef.current = messageHandler;
    const unsubscribe = onNewMessage(messageHandler);

    return () => {
      unsubscribe();
      messageHandlerRef.current = null;
    };
  }, [onNewMessage, isConnected, isAuthenticated, updateChatLastMessage]);

  // Initialize chats when authentication is established
  useEffect(() => {
    if (isAuthenticated && user && !isInitialized) {
      console.log('Initializing chats after authentication');
      setIsLoading(true);
      loadChats().finally(() => {
        setIsLoading(false);
      });
    } else if (!isAuthenticated) {
      // Reset state when not authenticated
      console.log('Resetting chat state - not authenticated');
      setChats([]);
      setCurrentChat(null);
      setMessages([]);
      setPage(1);
      setHasMore(true);
      setIsInitialized(false);
    }
  }, [isAuthenticated, user, isInitialized, loadChats]);

  // Auto-refresh chats when WebSocket connects (but don't show loading)
  useEffect(() => {
    if (isConnected && isAuthenticated && user && isInitialized) {
      console.log('WebSocket connected - refreshing chats');
      // Small delay to ensure connection is stable, then refresh silently
      setTimeout(() => {
        loadChats(false);
      }, 1000);
    }
  }, [isConnected, isAuthenticated, user, isInitialized, loadChats]);

  // Periodic refresh for real-time updates (reduced frequency)
  useEffect(() => {
    if (!isAuthenticated || !user || !isInitialized) return;

    const interval = setInterval(() => {
      // Only refresh if we haven't refreshed recently and connection is stable
      if (Date.now() - lastRefresh > 10000 && isConnected) {
        console.log('Periodic chat refresh');
        loadChats(false);
      }
    }, 60000); // Refresh every 60 seconds (reduced from 30)

    return () => clearInterval(interval);
  }, [isAuthenticated, user, loadChats, lastRefresh, isConnected, isInitialized]);

  return {
    chats,
    currentChat,
    messages,
    isLoading,
    hasMore,
    isInitialized,
    loadChats,
    loadMessages,
    loadMoreMessages,
    createChat,
    sendMessage,
    setActiveChat,
    updateChatLastMessage,
  };
};