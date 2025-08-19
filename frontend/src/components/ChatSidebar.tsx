import React, { useState, useEffect } from 'react';
import { Chat, User } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { apiService } from '@/services/api';
import {
  MessageCircle,
  Plus,
  Search,
  Users,
  X,
  Check,
  Hash,
  UserCheck,
  Clock,
  MessageSquare,
  RefreshCw,
  Wifi,
  WifiOff,
  Loader,
  AlertCircle,
  User as UserIcon
} from 'lucide-react';
import { formatDistanceToNow } from '@/utils/dateUtils';

interface ChatSidebarProps {
  chats: Chat[];
  currentChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onCreateChat: (participantIds: string[], name?: string, type?: 'private' | 'group') => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  isInitialized?: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
                                                   chats,
                                                   currentChat,
                                                   onChatSelect,
                                                   onCreateChat,
                                                   isLoading = false,
                                                   onRefresh,
                                                   isInitialized = false
                                                 }) => {
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [chatName, setChatName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { user } = useAuth();
  const { onlineUsers, isConnected, connectionStatus } = useWebSocket();

  // Load users for new chat
  useEffect(() => {
    if (showNewChatModal) {
      const loadUsers = async () => {
        try {
          const response = await apiService.getUsers();
          if (response.success && response.data) {
            // Filter out current user
            const filteredUsers = response.data.users.filter(u => u.id !== user?.id);
            setUsers(filteredUsers);
          }
        } catch (error) {
          console.error('Error loading users:', error);
        }
      };
      loadUsers();
    }
  }, [showNewChatModal, user?.id]);

  // Reset modal state when closed
  useEffect(() => {
    if (!showNewChatModal) {
      setSelectedUsers([]);
      setChatName('');
      setIsGroup(false);
      setUserSearchQuery('');
      setIsCreating(false);
    }
  }, [showNewChatModal]);

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;

    const chatName = getChatName(chat, user?.id);
    const lastMessage = chat.lastMessage?.content || '';

    return (
        chatName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredUsers = users.filter(u => {
    if (!userSearchQuery) return true;
    return (
        u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
  });

  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleCreateChat = async () => {
    if (selectedUsers.length === 0 || isCreating) return;

    setIsCreating(true);
    try {
      const type = selectedUsers.length === 1 ? 'private' : 'group';
      const newChat = await onCreateChat(selectedUsers, chatName || undefined, type);
      if (newChat) {
        setShowNewChatModal(false);
        // Auto-select the new chat
        onChatSelect(newChat);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const getChatName = (chat: Chat, currentUserId?: string) => {
    if (chat.type === 'group') {
      return chat.name || `Group (${chat.participants.length})`;
    }

    const otherParticipant = chat.participants.find(p => p.id !== currentUserId);
    const isOnline = otherParticipant ? onlineUsers.includes(otherParticipant.id) : false;

    return (
        <div className="relative">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center shadow-sm">
          <span className="text-lg font-semibold text-white">
            {otherParticipant?.username.charAt(0).toUpperCase() || 'U'}
          </span>
          </div>
          {isOnline && (
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
          )}
        </div>
    );
  };

  const getLastMessagePreview = (chat: Chat) => {
    if (!chat.lastMessage) return 'No messages yet';

    const isOwn = chat.lastMessage.sender.id === user?.id;
    const senderName = isOwn ? 'You' : chat.lastMessage.sender.username;
    const content = chat.lastMessage.content.length > 35
        ? `${chat.lastMessage.content.substring(0, 35)}...`
        : chat.lastMessage.content;

    return `${senderName}: ${content}`;
  };

  const hasUnreadMessages = (chat: Chat) => {
    // This would be determined by your actual unread message logic
    // For now, using a simple check based on last message
    if (!chat.lastMessage) return false;
    return chat.lastMessage.sender.id !== user?.id && Math.random() > 0.8; // Mock for demo
  };

  const getUnreadCount = (chat: Chat) => {
    // Mock unread count - replace with actual logic
    return hasUnreadMessages(chat) ? Math.floor(Math.random() * 3) + 1 : 0;
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'connecting':
        return <Loader className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-red-500" />;
    }
  };

  const getConnectionStatus = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      default:
        return 'Disconnected';
    }
  };

  return (
      <>
        {/* Custom Scrollbar Styles */}
        <style jsx>{`
          .custom-sidebar-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: #e5e7eb transparent;
          }

          .custom-sidebar-scrollbar::-webkit-scrollbar {
            width: 4px;
          }

          .custom-sidebar-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }

          .custom-sidebar-scrollbar::-webkit-scrollbar-thumb {
            background-color: #e5e7eb;
            border-radius: 2px;
            transition: background-color 0.2s ease;
          }

          .custom-sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #d1d5db;
          }

          .chat-item {
            animation: slideInUp 0.3s ease-out forwards;
            opacity: 0;
            transform: translateY(20px);
          }

          @keyframes slideInUp {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>

        <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full shadow-sm">
          {/* Header */}
          <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-purple-50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Chats
                </h2>
                {/* Connection Status */}
                <div className="flex items-center space-x-1" title={getConnectionStatus()}>
                  {getConnectionIcon()}
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {onRefresh && (
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 disabled:opacity-50"
                        title="Refresh chats"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                )}
                <button
                    onClick={() => setShowNewChatModal(true)}
                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-all duration-200 transform hover:scale-105"
                    title="New chat"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/70 backdrop-blur-sm transition-all duration-200"
              />
            </div>
          </div>

          {/* Chat list */}
          <div className="flex-1 overflow-y-auto custom-sidebar-scrollbar">
            {!isInitialized ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Initializing chats...</p>
                </div>
            ) : isLoading && chats.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Loading chats...</p>
                </div>
            ) : (
                <>
                  {filteredChats.map((chat, index) => (
                      <div
                          key={chat.id}
                          onClick={() => onChatSelect(chat)}
                          className={`chat-item p-4 border-b border-gray-50 cursor-pointer transition-all duration-200 hover:bg-gray-50 group ${
                              currentChat?.id === chat.id
                                  ? 'bg-blue-50 border-blue-100 shadow-sm border-l-4 border-l-blue-500'
                                  : ''
                          }`}
                          style={{
                            animationDelay: `${index * 50}ms`
                          }}
                      >
                        <div className="flex items-center space-x-3">
                          {getChatAvatar(chat)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h3 className={`text-sm font-medium truncate ${
                                  currentChat?.id === chat.id ? 'text-blue-900' : 'text-gray-900'
                              }`}>
                                {getChatName(chat, user?.id)}
                              </h3>
                              <div className="flex items-center space-x-2">
                                {chat.lastMessage && (
                                    <span className="text-xs text-gray-500 flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                                      {formatDistanceToNow(new Date(chat.lastMessage.createdAt))}
                            </span>
                                )}
                                {getUnreadCount(chat) > 0 && (
                                    <div className="min-w-[20px] h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse px-1.5">
                                      {getUnreadCount(chat)}
                                    </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className={`text-sm truncate ${
                                  hasUnreadMessages(chat) ? 'text-gray-900 font-medium' : 'text-gray-500'
                              }`}>
                                {getLastMessagePreview(chat)}
                              </p>
                              {chat.type === 'group' && (
                                  <span className="text-xs text-gray-400 flex items-center ml-2">
                            <Users className="w-3 h-3 mr-1" />
                                    {chat.participants.length}
                          </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                  ))}

                  {filteredChats.length === 0 && !isLoading && (
                      <div className="p-8 text-center text-gray-500">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <MessageCircle className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-600 mb-2">
                          {searchQuery ? 'No chats found' : 'No conversations yet'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {searchQuery ? 'Try a different search term' : 'Start a new conversation to get started'}
                        </p>
                        {!searchQuery && (
                            <button
                                onClick={() => setShowNewChatModal(true)}
                                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                            >
                              Start New Chat
                            </button>
                        )}
                      </div>
                  )}
                </>
            )}
          </div>

          {/* Online Users Count & Connection Status */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2 text-gray-600">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span>{onlineUsers.length} online</span>
              </div>
              <div className="text-xs text-gray-500">
                {getConnectionStatus()}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced New Chat Modal */}
        {showNewChatModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl transform transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Plus className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">New Chat</h3>
                  </div>
                  <button
                      onClick={() => setShowNewChatModal(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Chat Type Selection */}
                  <div className="flex items-center space-x-4">
                    <button
                        onClick={() => setIsGroup(false)}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all duration-200 ${
                            !isGroup
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <MessageCircle className="w-4 h-4" />
                        <span className="font-medium">Direct</span>
                      </div>
                    </button>
                    <button
                        onClick={() => setIsGroup(true)}
                        className={`flex-1 p-3 rounded-lg border-2 transition-all duration-200 ${
                            isGroup
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span className="font-medium">Group</span>
                      </div>
                    </button>
                  </div>

                  {/* Group name */}
                  {isGroup && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Group Name
                        </label>
                        <input
                            type="text"
                            placeholder="Enter group name..."
                            value={chatName}
                            onChange={(e) => setChatName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        />
                      </div>
                  )}

                  {/* User selection */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Select {isGroup ? 'Members' : 'Contact'}
                        {selectedUsers.length > 0 && (
                            <span className="ml-2 text-blue-600">({selectedUsers.length} selected)</span>
                        )}
                      </label>
                    </div>

                    {/* User search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                          type="text"
                          placeholder="Search users..."
                          value={userSearchQuery}
                          onChange={(e) => setUserSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Selected users preview */}
                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 rounded-lg">
                          {selectedUsers.map(userId => {
                            const selectedUser = users.find(u => u.id === userId);
                            return (
                                <div key={userId} className="flex items-center space-x-1 bg-white px-2 py-1 rounded-full text-sm">
                                  <UserIcon className="w-3 h-3 text-gray-400" />
                                  <span>{selectedUser?.username}</span>
                                  <button
                                      onClick={() => setSelectedUsers(prev => prev.filter(id => id !== userId))}
                                      className="text-gray-400 hover:text-red-500 ml-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                            );
                          })}
                        </div>
                    )}

                    {/* User list */}
                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg custom-sidebar-scrollbar">
                      {filteredUsers.map((user) => (
                          <label
                              key={user.id}
                              className="flex items-center p-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                          >
                            <input
                                type={isGroup ? "checkbox" : "radio"}
                                name="selectedUser"
                                checked={selectedUsers.includes(user.id)}
                                onChange={(e) => {
                                  if (isGroup) {
                                    if (e.target.checked) {
                                      setSelectedUsers([...selectedUsers, user.id]);
                                    } else {
                                      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                    }
                                  } else {
                                    setSelectedUsers(e.target.checked ? [user.id] : []);
                                  }
                                }}
                                className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex items-center space-x-3 flex-1">
                              <div className="relative">
                                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                                </div>
                                {onlineUsers.includes(user.id) && (
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border border-white rounded-full"></div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                                <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              </div>
                              {selectedUsers.includes(user.id) && (
                                  <Check className="w-4 h-4 text-blue-600" />
                              )}
                              {onlineUsers.includes(user.id) && (
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Online" />
                              )}
                            </div>
                          </label>
                      ))}

                      {filteredUsers.length === 0 && (
                          <div className="p-4 text-center text-gray-500">
                            <UserCheck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm">
                              {userSearchQuery ? 'No users found' : 'No users available'}
                            </p>
                          </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3 mt-6">
                  <button
                      onClick={() => setShowNewChatModal(false)}
                      className="flex-1 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                      onClick={handleCreateChat}
                      disabled={selectedUsers.length === 0 || isCreating}
                      className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center"
                  >
                    {isCreating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Creating...
                        </>
                    ) : (
                        `Create ${isGroup ? 'Group' : 'Chat'}`
                    )}
                  </button>
                </div>
              </div>
            </div>
        )}
      </>
  );
};

export default ChatSidebar;

const getChatAvatar = (chat: Chat) => {
  if (chat.type === 'group') {
    return (
        <div className="relative">
          <div
              className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-sm">
            <Users className="w-6 h-6 text-white"/>
          </div>
          <div
              className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
            <Hash className="w-2 h-2 text-white"/>
          </div>
        </div>
    );
  }
}