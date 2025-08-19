import { WebSocketMessage, Message, User } from '@/types';

type WebSocketEventHandler = (data: any) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private isManualClose = false;

  constructor() {
    this.eventHandlers = new Map();
  }

  connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';
      const url = `${wsUrl}/ws?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isManualClose = false;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('🔴 WebSocket disconnected:', event.code, event.reason);
        
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect(token);
          }, this.reconnectInterval * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };
    });
  }

  disconnect(): void {
    this.isManualClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.eventHandlers.get(message.type) || [];
    handlers.forEach(handler => handler(message.payload));
  }

  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event: string, payload: any, chatId?: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message: WebSocketMessage = {
        type: event,
        payload,
        chatId
      };
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  // Convenience methods
  joinRoom(chatId: string): void {
    this.emit('join_room', { chatId }, chatId);
  }

  leaveRoom(chatId: string): void {
    this.emit('leave_room', { chatId }, chatId);
  }

  sendMessage(chatId: string, content: string, messageType = 'text'): void {
    this.emit('send_message', {
      chatId,
      content,
      messageType
    }, chatId);
  }

  startTyping(chatId: string): void {
    this.emit('typing_start', { chatId }, chatId);
  }

  stopTyping(chatId: string): void {
    this.emit('typing_stop', { chatId }, chatId);
  }

  markMessageAsRead(messageId: string, chatId: string): void {
    this.emit('message_read', { messageId, chatId }, chatId);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocketService = new WebSocketService();