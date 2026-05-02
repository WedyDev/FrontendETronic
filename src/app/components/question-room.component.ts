import {
  Component,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CollaborationService } from '../services/collaboration.service';
import { AnonymousQuestion, User } from '../types/collaboration.types';

interface Question {
  id: string;
  text: string;
  timestamp: Date;
  isAnswered: boolean;
  displayColor: string;
  answers: Answer[];
  skipVotes: number;
  skipThreshold: number;
}

interface Answer {
  id: string;
  text: string;
  timestamp: Date;
  displayColor: string;
}

@Component({
  selector: 'app-question-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './question-room.component.html',
  styleUrl: './question-room.component.css'
})
export class QuestionRoomComponent implements OnInit, OnDestroy {
  isConnected = false;
  isJoined = false;

  currentUser: User | null = null;
  users: User[] = [];
  username = '';
  roomCode = 'ROOM' + Math.random().toString(36).substring(2, 8).toUpperCase();

  questions: Question[] = [];
  newQuestion = '';
  answerTexts: { [questionId: string]: string } = {};
  openAnswerForms: Set<string> = new Set();

  activityLog: { icon: string; text: string; time: string }[] = [];

  private destroy$ = new Subject<void>();
  private sessionKey = 'etronic_session';

  constructor(
    private collaborationService: CollaborationService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.setupLocalMode();
    this.loadPreviousSession();
  }

  private loadPreviousSession(): void {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.roomCode && session.username) {
          this.roomCode = session.roomCode;
          this.username = session.username;
        }
      }
    } catch (error) {
      console.log('No hay sesión anterior');
    }
  }

  private setupLocalMode(): void {
    this.addActivity('✅', 'Aplicación lista');
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupConnection();
      this.tryRestoreSession();
    }
  }

  private tryRestoreSession(): void {
    try {
      const stored = localStorage.getItem(this.sessionKey);
      if (stored) {
        const session = JSON.parse(stored);
        if (session.roomCode && session.username && this.isConnected) {
          setTimeout(() => {
            if (this.isConnected && !this.isJoined) {
              this.collaborationService.joinSession(session.username, session.roomCode)
                .then((user) => {
                  this.currentUser = user;
                  this.username = user.username;
                  this.roomCode = user.roomCode;
                  this.isJoined = true;
                  this.setupSubscriptions();
                  this.addActivity('🔄', 'Sesión restaurada');
                })
                .catch((error) => {
                  console.log('No se pudo restaurar la sesión', error);
                });
            }
          }, 500);
        }
      }
    } catch (error) {
      console.log('Error al restaurar sesión');
    }
  }

  private setupConnection(): void {
    this.collaborationService.connect('http://localhost:3000')
      .then(() => {
        this.isConnected = true;
        this.setupSubscriptions();
        this.addActivity('🔌', 'Conectado al servidor');
        this.tryRestoreSession();
      })
      .catch(() => {
        this.isConnected = false;
        this.addActivity('⚠️', 'Modo offline - sin servidor');
      });
  }

  joinRoom(): void {
    if (!this.username.trim()) {
      alert('Por favor ingresa tu nombre');
      return;
    }

    this.roomCode = this.roomCode.trim().toUpperCase();

    // Cambiar la vista de inmediato para que la transición no dependa de la respuesta del socket.
    if (!this.currentUser) {
      this.currentUser = {
        id: Date.now().toString(),
        username: this.username,
        color: this.getRandomColor(),
        socketId: 'pending-' + Date.now(),
        roomCode: this.roomCode,
        cursorPosition: { x: 0, y: 0 },
        isActive: true,
        joinedAt: new Date()
      };
    }
    this.isJoined = true;

    if (this.isConnected) {
      this.collaborationService.joinSession(this.username, this.roomCode)
        .then((user) => {
          this.currentUser = user;
          this.roomCode = user.roomCode;
          this.enterRoom();
        })
        .catch(() => {
          this.enterRoomLocal();
        });
    } else {
      this.enterRoomLocal();
    }
  }

  private enterRoom(): void {
    this.isJoined = true;
    this.setupSubscriptions();
    this.addActivity('📍', 'Entrada a la sala');
  }

  private enterRoomLocal(): void {
    this.isJoined = true;
    this.currentUser = {
      id: Date.now().toString(),
      username: this.username,
      color: this.getRandomColor(),
      socketId: 'local-' + Date.now(),
      roomCode: this.roomCode,
      cursorPosition: { x: 0, y: 0 },
      isActive: true,
      joinedAt: new Date()
    };
    this.users = [this.currentUser];
    this.addActivity('📍', 'Entrada a la sala');
  }

  private getRandomColor(): string {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private setupSubscriptions(): void {
    try {
      this.collaborationService.currentUser$
        .pipe(takeUntil(this.destroy$))
        .subscribe(
          (user) => {
            if (user) this.currentUser = user;
          },
          (error) => console.log('Error en user', error)
        );

      this.collaborationService.users$
        .pipe(takeUntil(this.destroy$))
        .subscribe(
          (users) => {
            this.users = users ?? [];
          },
          (error) => console.log('Error en users', error)
        );

      this.collaborationService.questions$
        .pipe(takeUntil(this.destroy$))
        .subscribe(
          (questions) => {
            this.questions = this.mapQuestions(questions ?? []);
          },
          (error) => console.log('Error en questions', error)
        );
    } catch (error) {
      console.log('Subscripciones no disponibles');
    }
  }

  private mapQuestions(questions: AnonymousQuestion[]): Question[] {
    return questions.map((question) => ({
      id: question.id,
      text: question.text,
      timestamp: question.timestamp,
      isAnswered: question.isAnswered,
      displayColor: question.displayColor,
      answers: question.answers.map((answer) => ({
        id: answer.id,
        text: answer.text,
        timestamp: answer.timestamp,
        displayColor: answer.displayColor,
      })),
      skipVotes: question.skipVotes,
      skipThreshold: question.skipThreshold,
    }));
  }

  submitQuestion(): void {
    if (!this.newQuestion.trim()) {
      return;
    }

    const questionText = this.newQuestion.trim();
    this.newQuestion = '';
    this.addActivity('❓', 'Se publicó una pregunta anónima');

    if (this.isConnected) {
      this.collaborationService.addQuestion(questionText).catch((error) => {
        console.log('No se pudo enviar la pregunta al servidor', error);
      });
      return;
    }

    const question: Question = {
      id: Date.now().toString(),
      text: questionText,
      timestamp: new Date(),
      isAnswered: false,
      displayColor: this.getRandomColor(),
      answers: [],
      skipVotes: 0,
      skipThreshold: Math.max(Math.floor(this.users.length / 2) + 1, 1),
    };

    this.questions.unshift(question);
  }

  voteSkip(questionId: string): void {
    const question = this.questions.find((item) => item.id === questionId);
    if (!question) return;

    if (this.isConnected) {
      this.collaborationService.voteSkip(questionId)
        .then((skipped) => {
          if (skipped) {
            this.addActivity('⏭️', 'Una pregunta fue omitida por mayoría');
          }
        })
        .catch((error) => {
          console.log('No se pudo votar skip', error);
        });
      return;
    }

    question.skipVotes += 1;
    if (question.skipVotes >= question.skipThreshold) {
      this.questions = this.questions.filter((item) => item.id !== questionId);
      this.addActivity('⏭️', 'Una pregunta fue omitida por mayoría');
    }
  }

  toggleAnswerForm(questionId: string): void {
    if (this.openAnswerForms.has(questionId)) {
      this.openAnswerForms.delete(questionId);
    } else {
      this.openAnswerForms.clear();
      this.openAnswerForms.add(questionId);
    }
  }

  isAnswerFormOpen(questionId: string): boolean {
    return this.openAnswerForms.has(questionId);
  }

  submitAnswer(questionId: string): void {
    const text = this.answerTexts[questionId];
    if (!text || !text.trim()) {
      return;
    }

    const question = this.questions.find((item) => item.id === questionId);
    if (!question) return;

    const answer: Answer = {
      id: Date.now().toString(),
      text: text.trim(),
      timestamp: new Date(),
      displayColor: this.getRandomColor(),
    };

    this.answerTexts[questionId] = '';
    this.openAnswerForms.delete(questionId);
    this.addActivity('💬', 'Se publicó una respuesta anónima');

    if (this.isConnected) {
      this.collaborationService.answerQuestion(questionId, answer.text).catch((error) => {
        console.log('No se pudo enviar la respuesta al servidor', error);
      });
      return;
    }

    question.answers.push(answer);
    question.isAnswered = true;
  }

  getTotalAnswers(): number {
    return this.questions.reduce((sum, question) => sum + question.answers.length, 0);
  }

  getAnsweredCount(): number {
    return this.questions.filter((question) => question.isAnswered).length;
  }

  getSkipLabel(question: Question): string {
    return `${question.skipVotes}/${question.skipThreshold}`;
  }

  getRecentActivity(): { icon: string; text: string; time: string }[] {
    return this.activityLog.slice(0, 5);
  }

  private addActivity(icon: string, text: string): void {
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    this.activityLog.unshift({ icon, text, time });
    if (this.activityLog.length > 20) {
      this.activityLog.pop();
    }
  }

  getStatusText(user: User): string {
    if (user.id === this.currentUser?.id) {
      return 'Tú';
    }
    return 'En línea';
  }

  getFormattedTime(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  leaveRoom(): void {
    try {
      this.collaborationService.disconnect();
    } catch (error) {
      console.log('Error desconectando');
    }

    this.isJoined = false;
    this.currentUser = null;
    this.users = [];
    this.questions = [];
    this.username = '';
    this.newQuestion = '';
    this.answerTexts = {};
    this.openAnswerForms.clear();
    this.activityLog = [];
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.leaveRoom();
  }
}