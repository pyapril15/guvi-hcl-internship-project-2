import React from 'react';
import { Message } from '@/types';
import { formatTime, formatDistanceToNow } from '@/utils/dateUtils';
import { Check, CheckCheck, Edit3 } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwn, showAvatar }) => {
  const formatMessageTime = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffInHours = (now.getTime() - messageDate.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return formatTime(messageDate);
    } else {
      return formatDistanceToNow(messageDate);
    }
  };

  return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} items-end space-x-2`}>
        {/* Avatar for received messages */}
        {!isOwn && showAvatar && (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-semibold text-white">
            {message.sender.username.charAt(0).toUpperCase()}
          </span>
            </div>
        )}

        {!isOwn && !showAvatar && <div className="w-8" />}

        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'order-last' : ''}`}>
          {/* Sender name for received messages */}
          {!isOwn && showAvatar && (
              <p className="text-xs text-gray-600 mb-1 px-3 font-medium">{message.sender.username}</p>
          )}

          {/* Message bubble */}
          <div
              className={`px-4 py-2 rounded-2xl shadow-sm ${
                  isOwn
                      ? 'bg-blue-500 text-white rounded-br-md'
                      : 'bg-gray-50 text-gray-900 border border-gray-100 rounded-bl-md'
              }`}
          >
            <p className="text-sm leading-relaxed break-words">{message.content}</p>

            <div className={`flex items-center justify-end mt-1 space-x-1 ${
                isOwn ? 'text-blue-100' : 'text-gray-500'
            }`}>
              {message.isEdited && (
                  <Edit3 className="w-3 h-3 opacity-75" />
              )}
              <span className="text-xs opacity-90">
              {formatMessageTime(message.createdAt)}
            </span>

              {isOwn && (
                  <div className="flex opacity-90">
                    {message.readBy.length > 0 ? (
                        <CheckCheck className="w-3 h-3" />
                    ) : (
                        <Check className="w-3 h-3" />
                    )}
                  </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};

export default MessageBubble;