import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Chat, Message } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import {
  Send,
  Smile,
  Paperclip,
  MoreVertical,
  ChevronDown,
  Users,
  Phone,
  Video,
  Info,
  Wifi,
  WifiOff,
  AlertCircle, MessageCircle
} from 'lucide-react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { formatDistanceToNow } from '@/utils/dateUtils';

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  onSendMessage: (content: string) => Promise<void> | void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  onMessagesUpdate?: (messages: Message[]) => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({
                                                 chat,
                                                 messages,
                                                 onSendMessage,
                                                 onLoadMore,
                                                 hasMore,
                                                 isLoading
                                               }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showChatInfo, setShowChatInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastMessageCountRef = useRef(messages.length);

  const { user } = useAuth();
  const {
    startTyping,
    stopTyping,
    typingUsers,
    onlineUsers,
    isConnected,
    connectionStatus
  } = useWebSocket();

  // Combine messages from props with local optimistic messages
  const allMessages = React.useMemo(() => {
    const messageMap = new Map();

    // Add all messages from props
    messages.forEach(msg => messageMap.set(msg.id, msg));

    // Add local messages (optimistic updates) that aren't confirmed yet
    localMessages.forEach(msg => {
      if (!messageMap.has(msg.id)) {
        messageMap.set(msg.id, msg);
      }
    });

    // Sort by creation date
    return Array.from(messageMap.values()).sort((a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [messages, localMessages]);

  // Auto-scroll to bottom when new messages arrive or when at bottom
  useEffect(() => {
    const shouldAutoScroll = isAtBottom || messages.length > lastMessageCountRef.current;

    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    lastMessageCountRef.current = messages.length;
  }, [allMessages, isAtBottom, messages.length]);

  // Clean up local messages when they appear in props (confirmed by server)
  useEffect(() => {
    setLocalMessages(prevLocal =>
        prevLocal.filter(localMsg =>
            !messages.some(propsMsg =>
                // Match by content, sender, and approximate time
                propsMsg.content === localMsg.content &&
                propsMsg.sender.id === localMsg.sender.id &&
                Math.abs(new Date(propsMsg.createdAt).getTime() - new Date(localMsg.createdAt).getTime()) < 10000
            )
        )
    );
  }, [messages]);

  // Focus input when chat changes
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    // Reset local messages when chat changes
    setLocalMessages([]);
    setMessage('');
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [chat.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const messageContent = message.trim();

    if (!messageContent || isSending || !user) return;

    setIsSending(true);

    // Create optimistic message for immediate UI update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}-${Math.random()}`,
      content: messageContent,
      sender: {
        id: user.id,
        username: user.username || 'You',
        email: '',
        isOnline: false,
      },
      chatId: chat.id,
      createdAt: new Date(),
      isEdited: false,
      readBy: []
    };

    // Add optimistic message to local state
    setLocalMessages(prev => [...prev, optimisticMessage]);

    // Clear input immediately
    setMessage('');
    handleStopTyping();

    // Scroll to bottom
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);

    try {
      // Send message to server
      await onSendMessage(messageContent);
    } catch (error) {
      console.error('Failed to send message:', error);

      // Remove optimistic message on error
      setLocalMessages(prev =>
          prev.filter(msg => msg.id !== optimisticMessage.id)
      );

      // Restore message content
      setMessage(messageContent);

      // Show error (you might want to add proper error handling UI)
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Handle typing indicators
    if (e.target.value && !isTyping && isConnected) {
      setIsTyping(true);
      startTyping(chat.id);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    if (e.target.value) {
      typingTimeoutRef.current = setTimeout(() => {
        handleStopTyping();
      }, 2000);
    } else {
      handleStopTyping();
    }
  };

  const handleStopTyping = useCallback(() => {
    if (isTyping && isConnected) {
      setIsTyping(false);
      stopTyping(chat.id);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [isTyping, isConnected, stopTyping, chat.id]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = element;

    // Check if user is at the bottom (within 100px threshold)
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(atBottom);

    // Show/hide scroll to bottom button
    setShowScrollToBottom(!atBottom && scrollTop > 300);

    // Load more messages when scrolled to top
    if (scrollTop === 0 && hasMore && !isLoading) {
      onLoadMore();
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      setShowScrollToBottom(false);
      setIsAtBottom(true);
    }
  };

  const getChatName = () => {
    if (chat.type === 'group') {
      return chat.name || `Group (${chat.participants.length})`;
    }

    const otherParticipant = chat.participants.find(p => p.id !== user?.id);
    return otherParticipant?.username || 'Unknown User';
  };

  const getChatStatus = () => {
    if (chat.type === 'group') {
      const onlineCount = chat.participants.filter(p =>
          p.id !== user?.id && onlineUsers.includes(p.id)
      ).length;
      const totalOthers = chat.participants.length - 1;
      return `${onlineCount} of ${totalOthers} online`;
    }

    const otherParticipant = chat.participants.find(p => p.id !== user?.id);
    if (!otherParticipant) return 'Unknown';

    if (onlineUsers.includes(otherParticipant.id)) {
      return 'Online';
    }

    // You'd need to implement lastSeen tracking
    return 'Offline';
  };

  const getAvatarColor = () => {
    if (chat.type === 'group') {
      return 'bg-gradient-to-br from-green-400 to-blue-500';
    }
    return 'bg-gradient-to-br from-blue-400 to-purple-500';
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <div className="w-4 h-4 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const currentTypingUsers = typingUsers.filter(tu =>
      tu.chatId === chat.id && tu.userId !== user?.id
  );

  return (
      <div className="flex-1 flex flex-col bg-gray-50 h-full">
        {/* Custom Scrollbar Styles */}
        <style jsx>{`
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #cbd5e0 transparent;
          }

          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }

          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #cbd5e0;
            border-radius: 3px;
            transition: background-color 0.2s ease;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #a0aec0;
          }

          .custom-scrollbar::-webkit-scrollbar-thumb:active {
            background-color: #718096;
          }

          .message-fade-in {
            animation: fadeIn 0.3s ease-out;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getAvatarColor()} shadow-sm`}>
                {chat.type === 'group' ? (
                    <Users className="w-5 h-5 text-white" />
                ) : (
                    <span className="text-sm font-semibold text-white">
                  {getChatName().charAt(0).toUpperCase()}
                </span>
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{getChatName()}</h3>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <span>{getChatStatus()}</span>
                  <div className="flex items-center space-x-1">
                    {getConnectionIcon()}
                  </div>
                  {currentTypingUsers.length > 0 && (
                      <span className="text-blue-600 font-medium">
                    {currentTypingUsers.length === 1
                        ? `${currentTypingUsers[0].username} is typing...`
                        : `${currentTypingUsers.length} people are typing...`
                    }
                  </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <Video className="w-5 h-5" />
              </button>
              <button
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Info className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Chat Info Panel */}
          {showChatInfo && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Participants</h4>
                    <div className="space-y-2">
                      {chat.participants.map(participant => (
                          <div key={participant.id} className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-semibold text-white">
                          {participant.username.charAt(0).toUpperCase()}
                        </span>
                            </div>
                            <span className="text-sm text-gray-700">{participant.username}</span>
                            {participant.id === user?.id && (
                                <span className="text-xs text-gray-500">(You)</span>
                            )}
                            {onlineUsers.includes(participant.id) && (
                                <div className="w-2 h-2 bg-green-500 rounded-full" title="Online" />
                            )}
                          </div>
                      ))}
                    </div>
                  </div>

                  {chat.type === 'group' && (
                      <div>
                        <h4 className="font-medium text-gray-900">Group Info</h4>
                        <p className="text-sm text-gray-600">
                          Created {formatDistanceToNow(new Date(chat.createdAt))} ago
                        </p>
                      </div>
                  )}
                </div>
              </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 relative min-h-0">
          <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto p-4 space-y-3 custom-scrollbar"
          >
            {/* Load More Indicator */}
            {isLoading && hasMore && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center space-x-2 text-gray-500">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm">Loading more messages...</span>
                  </div>
                </div>
            )}

            {/* Messages */}
            {allMessages.map((msg, index) => {
              const showAvatar = index === 0 ||
                  allMessages[index - 1].sender.id !== msg.sender.id ||
                  new Date(msg.createdAt).getTime() - new Date(allMessages[index - 1].createdAt).getTime() > 300000; // 5 minutes

              const isOptimistic = msg.id.startsWith('temp-');

              return (
                  <div key={msg.id} className={`message-fade-in ${isOptimistic ? 'opacity-70' : ''}`}>
                    <MessageBubble
                        message={msg}
                        isOwn={msg.sender.id === user?.id}
                        showAvatar={showAvatar}
                    />
                  </div>
              );
            })}

            {/* Typing Indicator */}
            {currentTypingUsers.length > 0 && (
                <div className="message-fade-in">
                  <TypingIndicator users={currentTypingUsers} />
                </div>
            )}

            {/* Empty State */}
            {allMessages.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-lg font-medium mb-2">No messages yet</p>
                  <p className="text-gray-400">Send a message to start the conversation</p>
                </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to Bottom Button */}
          {showScrollToBottom && (
              <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-4 p-3 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-gray-50 z-10 group"
              >
                <ChevronDown className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              </button>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
            <div className="flex-1">
              <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={handleInputChange}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    placeholder={`Message ${getChatName()}...`}
                    disabled={!isConnected}
                    className="w-full px-4 py-3 pr-20 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                  <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {!isConnected && (
                  <p className="text-sm text-red-500 mt-1 flex items-center">
                    <WifiOff className="w-3 h-3 mr-1" />
                    Disconnected - messages will be sent when connection is restored
                  </p>
              )}
            </div>

            <button
                type="submit"
                disabled={!message.trim() || isSending || !isConnected}
                className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm relative"
            >
              {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                  <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>
  );
};

export default ChatWindow;