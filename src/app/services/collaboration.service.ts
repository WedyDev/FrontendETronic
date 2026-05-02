import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import {
  User,
  DrawingAction,
  ChatMessage,
  CursorUpdate,
  AnonymousQuestion,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../types/collaboration.types';

@Injectable({
  providedIn: 'root',
})
export class CollaborationService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
  private currentUser = new BehaviorSubject<User | null>(null);
  private users = new BehaviorSubject<User[]>([]);
  private drawingActions = new BehaviorSubject<DrawingAction[]>([]);
  private chatMessages = new BehaviorSubject<ChatMessage[]>([]);
  private cursors = new BehaviorSubject<CursorUpdate[]>([]);
  private questions = new BehaviorSubject<AnonymousQuestion[]>([]);
  private isConnected = new BehaviorSubject<boolean>(false);
  private currentRoomCode: string | null = null;
  private sessionKey = 'etronic_session';
  private reconnectAttempts = 0;

  public currentUser$ = this.currentUser.asObservable();
  public users$ = this.users.asObservable();
  public drawingActions$ = this.drawingActions.asObservable();
  public chatMessages$ = this.chatMessages.asObservable();
  public cursors$ = this.cursors.asObservable();
  public questions$ = this.questions.asObservable();
  public isConnected$ = this.isConnected.asObservable();

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        this.currentRoomCode = session.roomCode;
      }
    } catch (error) {
      console.log('No se pudo cargar la sesión anterior');
    }
  }

  private saveSession(username: string, roomCode: string): void {
    try {
      localStorage.setItem(this.sessionKey, JSON.stringify({ username, roomCode }));
    } catch (error) {
      console.log('No se pudo guardar la sesión');
    }
  }

  public clearSession(): void {
    try {
      localStorage.removeItem(this.sessionKey);
      this.currentRoomCode = null;
    } catch (error) {
      console.log('No se pudo limpiar la sesión');
    }
  }

  public getCurrentRoomCode(): string | null {
    return this.currentRoomCode;
  }

  private resetRoomState(): void {
    this.users.next([]);
    this.drawingActions.next([]);
    this.chatMessages.next([]);
    this.cursors.next([]);
    this.questions.next([]);
  }

  connect(serverUrl: string = 'https://backendetronic.onrender.com'): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        console.log('[CONEXIÓN] Ya conectado al servidor');
        this.isConnected.next(true);
        resolve();
        return;
      }

      this.socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        console.log('[CONEXIÓN] Conectado al servidor WebSocket');
        this.isConnected.next(true);
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('[DESCONEXIÓN] Desconectado del servidor');
        this.isConnected.next(false);
      });

     

      this.socket.on('user:joined', (user: User) => {
        console.log(`[USUARIO UNIDO] ${user.username}`);
      });

      this.socket.on('user:left', (userId: string) => {
        console.log(`[USUARIO SALIÓ] ${userId}`);
        const currentUsers = this.users.value.filter((u) => u.id !== userId);
        this.users.next(currentUsers);
      });

      this.socket.on('users:list', (usersList: User[]) => {
        this.users.next(usersList);
      });

      this.socket.on('drawing:action', (action: DrawingAction) => {
        const currentActions = this.drawingActions.value;
        this.drawingActions.next([...currentActions, action]);
      });

      this.socket.on('cursor:update', (cursor: CursorUpdate) => {
        const currentCursors = this.cursors.value;
        const index = currentCursors.findIndex(
          (c) => c.userId === cursor.userId
        );

        if (index >= 0) {
          currentCursors[index] = cursor;
        } else {
          currentCursors.push(cursor);
        }

        this.cursors.next([...currentCursors]);
      });

      this.socket.on('chat:message', (message: ChatMessage) => {
        const currentMessages = this.chatMessages.value;
        this.chatMessages.next([...currentMessages, message]);
      });

      this.socket.on('canvas:sync', (actions: DrawingAction[]) => {
        console.log(`[SINCRONIZACIÓN] Recibidas ${actions.length} acciones`);
        this.drawingActions.next(actions);
      });

      this.socket.on('chat:messages', (messages: ChatMessage[]) => {
        this.chatMessages.next(messages);
      });

      this.socket.on('questions:list', (questions: AnonymousQuestion[]) => {
        console.log(`[PREGUNTAS] Recibidas ${questions.length} preguntas`);
        this.questions.next(questions);
      });

      this.socket.on('canvas:cleared', () => {
        this.drawingActions.next([]);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[ERROR DE CONEXIÓN]', error);
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });
    });
  }

  joinSession(username: string, roomCode: string): Promise<User> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket no inicializado'));
        return;
      }

      this.currentRoomCode = roomCode;
      this.resetRoomState();
      this.saveSession(username, roomCode);

      this.socket.emit('user:join', username, roomCode, (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
        } else {
          this.currentUser.next(response);
          resolve(response);
        }
      });
    });
  }

  sendDrawingAction(action: any): void {
    if (this.socket) {
      this.socket.emit('drawing:action', action);
    }
  }

  moveCursor(position: { x: number; y: number }): void {
    if (this.socket) {
      this.socket.emit('cursor:move', position);
    }
  }

  sendChatMessage(message: string): void {
    if (this.socket) {
      this.socket.emit('chat:send', message);
    }
  }

  addQuestion(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket no inicializado'));
        return;
      }

      this.socket.emit('question:add', text, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        resolve();
      });
    });
  }

  answerQuestion(questionId: string, text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket no inicializado'));
        return;
      }

      this.socket.emit('question:answer', { questionId, text }, (response: { error?: string }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        resolve();
      });
    });
  }

  voteSkip(questionId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket no inicializado'));
        return;
      }

      this.socket.emit('question:voteSkip', questionId, (response: { error?: string; skipped?: boolean }) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }

        resolve(Boolean(response.skipped));
      });
    });
  }

  clearCanvas(): void {
    if (this.socket) {
      this.socket.emit('canvas:clear');
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.isConnected.next(false);
    }
    this.clearSession();
    this.currentUser.next(null);
    this.resetRoomState();
  }
}
