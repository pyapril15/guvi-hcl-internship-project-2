import React from 'react';
import { TypingUser } from '@/types';
import { MessageCircle } from 'lucide-react';

interface TypingIndicatorProps {
  users: TypingUser[];
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].username} is typing`;
    } else if (users.length === 2) {
      return `${users[0].username} and ${users[1].username} are typing`;
    } else if (users.length === 3) {
      return `${users[0].username}, ${users[1].username}, and ${users[2].username} are typing`;
    } else {
      return `${users[0].username} and ${users.length - 1} others are typing`;
    }
  };

  const getAvatars = () => {
    const displayUsers = users.slice(0, 3); // Show max 3 avatars
    return displayUsers.map((user, index) => (
        <div
            key={user.userId}
            className={`w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${
                index > 0 ? '-ml-2' : ''
            }`}
            style={{ zIndex: displayUsers.length - index }}
            title={user.username}
        >
        <span className="text-xs font-medium text-white">
          {user.username.charAt(0).toUpperCase()}
        </span>
        </div>
    ));
  };

  return (
      <div className="flex items-start space-x-3 animate-fade-in">
        {/* User avatars */}
        <div className="flex items-center mt-1">
          {getAvatars()}
          {users.length > 3 && (
              <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center border-2 border-white shadow-sm -ml-2 text-xs font-medium text-gray-600">
                +{users.length - 3}
              </div>
          )}
        </div>

        {/* Typing bubble */}
        <div className="bg-gray-100 rounded-2xl px-4 py-3 rounded-bl-sm shadow-sm max-w-xs">
          <div className="flex items-center space-x-2">
            <MessageCircle className="w-3 h-3 text-gray-500" />
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-600 font-medium">{getTypingText()}</span>
              <div className="flex space-x-0.5 ml-1">
                <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms', animationDuration: '1.4s' }}
                ></div>
                <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}
                ></div>
                <div
                    className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"
                    style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-8px);
          }
        }

        .animate-bounce {
          animation: bounce 1.4s infinite ease-in-out;
        }
      `}</style>
      </div>
  );
};

export default TypingIndicator;