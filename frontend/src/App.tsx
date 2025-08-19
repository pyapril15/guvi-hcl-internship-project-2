import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';
import {AuthProvider, useAuth} from '@/contexts/AuthContext';
import {WebSocketProvider} from '@/contexts/WebSocketContext';
import {useChat} from '@/hooks/useChat';
import AuthForm from '@/components/AuthForm';
import Layout from '@/components/Layout';
import ChatSidebar from '@/components/ChatSidebar';
import ChatWindow from '@/components/ChatWindow';
import {Loader, MessageCircle} from 'lucide-react';

const ChatApp: React.FC = () => {
    const {isAuthenticated, isLoading: authLoading, user} = useAuth();
    const {
        chats,
        currentChat,
        messages,
        hasMore,
        isLoading: chatLoading,
        isInitialized,
        createChat,
        sendMessage,
        loadMoreMessages,
        setActiveChat,
        loadChats,
        updateChatLastMessage,
    } = useChat();

    // Show loading screen during initial authentication check
    if (authLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                <div className="text-center">
                    <div
                        className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-xl font-semibold text-gray-700 mb-2">Loading ChatApp</h2>
                    <p className="text-gray-500">Please wait while we set things up...</p>
                </div>
            </div>
        );
    }

    // Show authentication form if not authenticated
    if (!isAuthenticated) {
        return <AuthForm/>;
    }

    // Handle message sending with proper error handling
    const handleSendMessage = async (content: string) => {
        if (!currentChat) return;

        try {
            const sentMessage = await sendMessage(currentChat.id, content);
            if (sentMessage) {
                // Update chat sidebar immediately
                updateChatLastMessage(sentMessage);
                // Refresh chats list to ensure correct ordering
                setTimeout(() => loadChats(false), 100);
            }
        } catch (error) {
            console.error('Failed to send message:', error);
            throw error; // Re-throw to let ChatWindow handle the error display
        }
    };

    // Enhanced chat creation with auto-selection
    const handleCreateChat = async (participantIds: string[], name?: string, type?: 'private' | 'group') => {
        try {
            const newChat = await createChat(participantIds, name, type);
            if (newChat) {
                // Auto-select the newly created chat
                setActiveChat(newChat);
                return newChat;
            }
        } catch (error) {
            console.error('Failed to create chat:', error);
            throw error;
        }
    };

    return (
        <Layout>
            <div className="h-full flex bg-white">
                {/* Sidebar */}
                <ChatSidebar
                    chats={chats}
                    currentChat={currentChat}
                    onChatSelect={setActiveChat}
                    onCreateChat={handleCreateChat}
                    isLoading={chatLoading && !isInitialized}
                    onRefresh={() => loadChats()}
                    isInitialized={isInitialized}
                />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {currentChat ? (
                        <ChatWindow
                            chat={currentChat}
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            onLoadMore={loadMoreMessages}
                            hasMore={hasMore}
                            isLoading={chatLoading}
                            onMessagesUpdate={() => {
                                // This callback can be used to refresh messages from server if needed
                                // For now, real-time updates are handled via WebSocket
                            }}
                        />
                    ) : (
                        <div
                            className="h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
                            <div className="text-center max-w-md mx-auto px-6">
                                <div
                                    className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                                    <MessageCircle className="w-12 h-12 text-white"/>
                                </div>

                                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                                    Welcome back, {user?.username}!
                                </h3>

                                <p className="text-gray-600 mb-6 text-lg">
                                    {chats.length === 0
                                        ? "You don't have any conversations yet. Start chatting by creating a new conversation!"
                                        : "Select a conversation from the sidebar to start messaging, or create a new chat."
                                    }
                                </p>

                                {/* Status indicators */}
                                <div className="space-y-4">
                                    {!isInitialized && (
                                        <div className="flex items-center justify-center space-x-2 text-blue-600">
                                            <Loader className="w-4 h-4 animate-spin"/>
                                            <span className="text-sm">Setting up your conversations...</span>
                                        </div>
                                    )}

                                    {isInitialized && chats.length === 0 && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <div
                                                className="flex items-center justify-center space-x-2 text-blue-700 mb-2">
                                                <MessageCircle className="w-5 h-5"/>
                                                <span className="font-medium">Ready to chat!</span>
                                            </div>
                                            <p className="text-sm text-blue-600 mb-3">
                                                Click the + button in the sidebar to start your first conversation.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    // You could trigger the new chat modal from here
                                                    // For now, just point to the sidebar button
                                                    const newChatButton = document.querySelector('[title="New chat"]') as HTMLButtonElement;
                                                    if (newChatButton) {
                                                        newChatButton.click();
                                                    }
                                                }}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                            >
                                                Start New Chat
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Quick stats */}
                                {isInitialized && chats.length > 0 && (
                                    <div className="mt-8 grid grid-cols-2 gap-4 text-center">
                                        <div className="bg-white rounded-lg p-4 shadow-sm border">
                                            <div className="text-2xl font-bold text-blue-600 mb-1">{chats.length}</div>
                                            <div className="text-sm text-gray-600">
                                                {chats.length === 1 ? 'Conversation' : 'Conversations'}
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 shadow-sm border">
                                            <div className="text-2xl font-bold text-green-600 mb-1">
                                                {chats.filter(chat => chat.lastMessage).length}
                                            </div>
                                            <div className="text-sm text-gray-600">Active Chats</div>
                                        </div>
                                    </div>
                                )}

                                {/* Tips */}
                                <div className="mt-8 text-left bg-white rounded-lg p-4 border shadow-sm">
                                    <h4 className="font-medium text-gray-800 mb-3">💡 Quick Tips:</h4>
                                    <ul className="text-sm text-gray-600 space-y-2">
                                        <li>• Click the + button to start a new conversation</li>
                                        <li>• Search conversations using the search bar</li>
                                        <li>• Create group chats with multiple people</li>
                                        <li>• Your connection status is shown in the top right</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
};

const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <WebSocketProvider>
                    <ChatApp/>
                </WebSocketProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;