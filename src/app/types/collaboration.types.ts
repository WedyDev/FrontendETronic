// Tipos compartidos entre cliente y servidor

export interface User {
  id: string;
  username: string;
  color: string;
  socketId: string;
  roomCode: string;
  cursorPosition?: { x: number; y: number };
  isActive: boolean;
  joinedAt: Date;
}

export interface DrawingAction {
  id: string;
  userId: string;
  type: 'draw' | 'clear' | 'undo' | 'text';
  data: any;
  timestamp: Date;
}

export interface SharedData {
  canvas: DrawingAction[];
  users: User[];
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  userColor: string;
}

export interface AnonymousAnswer {
  id: string;
  text: string;
  timestamp: Date;
  displayColor: string;
}

export interface AnonymousQuestion {
  id: string;
  text: string;
  timestamp: Date;
  isAnswered: boolean;
  displayColor: string;
  answers: AnonymousAnswer[];
  skipVotes: number;
  skipThreshold: number;
}

export interface CursorUpdate {
  userId: string;
  username: string;
  x: number;
  y: number;
  color: string;
}

export interface ServerToClientEvents {
  'user:joined': (user: User) => void;
  'user:left': (userId: string) => void;
  'users:list': (users: User[]) => void;
  'questions:list': (questions: AnonymousQuestion[]) => void;
  'drawing:action': (action: DrawingAction) => void;
  'cursor:update': (cursor: CursorUpdate) => void;
  'chat:message': (message: ChatMessage) => void;
  'canvas:sync': (actions: DrawingAction[]) => void;
  'chat:messages': (messages: ChatMessage[]) => void;
  'canvas:cleared': () => void;
}

export interface ClientToServerEvents {
  'user:join': (
    username: string,
    roomCode: string,
    callback: (user: User | { error: string }) => void
  ) => void;
  'user:disconnect': () => void;
  'drawing:action': (action: any) => void;
  'cursor:move': (position: { x: number; y: number }) => void;
  'chat:send': (message: string) => void;
  'question:add': (text: string, callback: (response: { error?: string }) => void) => void;
  'question:answer': (payload: { questionId: string; text: string }, callback: (response: { error?: string }) => void) => void;
  'question:voteSkip': (questionId: string, callback: (response: { error?: string; skipped?: boolean }) => void) => void;
  'canvas:clear': () => void;
}
