import { Component } from '@angular/core';
import { QuestionRoomComponent } from './components/question-room.component.js';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [QuestionRoomComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'Etronic';
}
