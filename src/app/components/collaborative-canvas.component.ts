import {
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CollaborationService } from '../services/collaboration.service';
import { User, DrawingAction, ChatMessage, CursorUpdate } from '../types/collaboration.types';

@Component({
  selector: 'app-collaborative-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collaborative-canvas.component.html',
  styleUrl: './collaborative-canvas.component.css'
})
export class CollaborativeCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('usernameInput') usernameInput!: ElementRef<HTMLInputElement>;

  // Estados
  isConnected = false;
  isJoined = false;
  currentUser: User | null = null;
  users: User[] = [];
  drawingActions: DrawingAction[] = [];
  chatMessages: ChatMessage[] = [];
  cursors: CursorUpdate[] = [];

  // Canvas
  private ctx: CanvasRenderingContext2D | null = null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;

  // Chat
  newMessage = '';

  // Username
  username = '';
  roomCode = 'ROOM' + Math.random().toString(36).substring(2, 8).toUpperCase();
  joinError = '';

  private destroy$ = new Subject<void>();

  constructor(private collaborationService: CollaborationService) {}

  ngOnInit(): void {
    this.setupObservables();
  }

  ngAfterViewInit(): void {
    if (this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      this.ctx = canvas.getContext('2d');
      this.resizeCanvas();
      window.addEventListener('resize', () => this.resizeCanvas());
    }
  }

  private setupObservables(): void {
    this.collaborationService.isConnected$
      .pipe(takeUntil(this.destroy$))
      .subscribe((isConnected) => {
        this.isConnected = isConnected;
      });

    this.collaborationService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.currentUser = user;
        if (user) {
          this.isJoined = true;
        }
      });

    this.collaborationService.users$
      .pipe(takeUntil(this.destroy$))
      .subscribe((users) => {
        this.users = users;
      });

    this.collaborationService.drawingActions$
      .pipe(takeUntil(this.destroy$))
      .subscribe((actions) => {
        this.drawingActions = actions;
        this.redrawCanvas();
      });

    this.collaborationService.chatMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe((messages) => {
        this.chatMessages = messages;
      });

    this.collaborationService.cursors$
      .pipe(takeUntil(this.destroy$))
      .subscribe((cursors) => {
        this.cursors = cursors.filter((c) => c.userId !== this.currentUser?.id);
        this.drawCursors();
      });
  }

  async connectToServer(): Promise<void> {
    try {
      await this.collaborationService.connect('http://localhost:3000');
    } catch (error) {
      console.error('Error conectando:', error);
      this.joinError = 'Error conectando al servidor';
    }
  }

  async joinSession(): Promise<void> {
    if (!this.username.trim()) {
      this.joinError = 'Por favor ingresa un nombre de usuario';
      return;
    }

    this.roomCode = this.roomCode.trim().toUpperCase();

    if (!this.isConnected) {
      await this.connectToServer();
    }

    try {
      await this.collaborationService.joinSession(this.username, this.roomCode);
      this.joinError = '';
      this.joinError = '';
    } catch (error: any) {
      this.joinError = error.message || 'Error al unirse a la sesión';
    }
  }

  // Canvas Drawing
  private resizeCanvas(): void {
    if (this.canvasRef) {
      const canvas = this.canvasRef.nativeElement;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      this.redrawCanvas();
    }
  }

  onMouseDown(e: MouseEvent): void {
    if (!this.isJoined) return;
    this.isDrawing = true;
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    this.lastX = e.clientX - rect.left;
    this.lastY = e.clientY - rect.top;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isJoined) return;

    // Actualizar cursor
    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.collaborationService.moveCursor({ x, y });

    // Dibujar
    if (this.isDrawing && this.ctx) {
      const canvas = this.canvasRef.nativeElement;
      this.ctx.strokeStyle = this.currentUser?.color || '#000';
      this.ctx.lineWidth = 2;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';

      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();

      // Enviar acción de dibujo
      this.collaborationService.sendDrawingAction({
        type: 'draw',
        data: {
          startX: this.lastX,
          startY: this.lastY,
          endX: x,
          endY: y,
          color: this.currentUser?.color,
          lineWidth: 2,
        },
      });

      this.lastX = x;
      this.lastY = y;
    }
  }

  onMouseUp(): void {
    this.isDrawing = false;
  }

  private redrawCanvas(): void {
    if (!this.ctx || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redibujar todas las acciones
    for (const action of this.drawingActions) {
      if (action.type === 'draw') {
        this.ctx.strokeStyle = action.data.color || '#000';
        this.ctx.lineWidth = action.data.lineWidth || 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.ctx.moveTo(action.data.startX, action.data.startY);
        this.ctx.lineTo(action.data.endX, action.data.endY);
        this.ctx.stroke();
      } else if (action.type === 'text') {
        this.ctx.fillStyle = action.data.color || '#000';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(action.data.text, action.data.x, action.data.y);
      }
    }

    this.drawCursors();
  }

  private drawCursors(): void {
    if (!this.ctx || !this.canvasRef) return;

    for (const cursor of this.cursors) {
      // Dibujar cursor
      this.ctx.fillStyle = cursor.color;
      this.ctx.fillRect(cursor.x, cursor.y, 10, 10);

      // Dibujar nombre
      this.ctx.fillStyle = cursor.color;
      this.ctx.font = 'bold 12px Arial';
      this.ctx.fillText(cursor.username, cursor.x + 12, cursor.y + 12);
    }
  }

  clearCanvas(): void {
    this.collaborationService.clearCanvas();
  }

  // Chat
  sendMessage(): void {
    if (!this.newMessage.trim() || !this.isJoined) return;
    this.collaborationService.sendChatMessage(this.newMessage);
    this.newMessage = '';
  }

  // Utility
  getFormattedTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  disconnect(): void {
    this.collaborationService.disconnect();
    this.isJoined = false;
    this.currentUser = null;
    this.users = [];
    this.drawingActions = [];
    this.chatMessages = [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }
}
