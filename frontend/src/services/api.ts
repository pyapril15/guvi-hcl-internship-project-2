import { ApiResponse, User, Chat, Message } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiService {
  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(options.headers?.hasOwnProperty('Authorization') !== false),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  // Auth endpoints
  async register(username: string, email: string, password: string) {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ username, email, password }),
    });
  }

  async login(email: string, password: string) {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
  }

  async getCurrentUser() {
    return this.request<{ user: User }>('/auth/me');
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST',
    });
  }

  // User endpoints
  async getUsers() {
    return this.request<{ users: User[] }>('/users');
  }

  async getUserById(id: string) {
    return this.request<{ user: User }>(`/users/${id}`);
  }

  async updateUser(id: string, data: Partial<User>) {
    return this.request<{ user: User }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Chat endpoints
  async getChats() {
    return this.request<{ chats: Chat[] }>('/chats');
  }

  async createChat(participantIds: string[], name?: string, type: 'private' | 'group' = 'private') {
    return this.request<{ chat: Chat }>('/chats', {
      method: 'POST',
      body: JSON.stringify({ participantIds, name, type }),
    });
  }

  async getChatById(id: string) {
    return this.request<{ chat: Chat }>(`/chats/${id}`);
  }

  async updateChat(id: string, data: { name?: string; participantIds?: string[] }) {
    return this.request<{ chat: Chat }>(`/chats/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChat(id: string) {
    return this.request(`/chats/${id}`, {
      method: 'DELETE',
    });
  }

  // Message endpoints
  async getMessages(chatId: string, page = 1, limit = 50) {
    return this.request<{ 
      messages: Message[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        hasMore: boolean;
      };
    }>(`/messages/chat/${chatId}?page=${page}&limit=${limit}`);
  }

  async sendMessage(
    chatId: string, 
    content: string, 
    messageType = 'text',
    fileUrl?: string,
    fileName?: string,
    fileSize?: number
  ) {
    return this.request<{ message: Message }>('/messages', {
      method: 'POST',
      body: JSON.stringify({ 
        chatId, 
        content, 
        messageType,
        ...(fileUrl && { fileUrl }),
        ...(fileName && { fileName }),
        ...(fileSize && { fileSize })
      }),
    });
  }

  async editMessage(id: string, content: string) {
    return this.request<{ message: Message }>(`/messages/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteMessage(id: string) {
    return this.request(`/messages/${id}`, {
      method: 'DELETE',
    });
  }

  async markMessageAsRead(messageId: string) {
    return this.request(`/messages/${messageId}/read`, {
      method: 'POST',
    });
  }
}

export const apiService = new ApiService();