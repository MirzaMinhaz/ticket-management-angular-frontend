// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive], // ✅ include CommonModule + RouterOutlet
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  notification: string | null = null;
  notificationType: 'success' | 'error' | null = null;

  constructor(private router: Router, private notify: NotificationService) {
    this.notify.message$.subscribe(msg => this.notification = msg);
    this.notify.type$.subscribe(type => this.notificationType = type);
  }

  getLoggedInUser(): string | null {
  return localStorage.getItem('username');
}


  showNavbar() {
    return !!localStorage.getItem('jwtToken');
  }

  closeNotification() {
    this.notify.clear();
  }

  logout() {
    localStorage.removeItem('jwtToken');
    this.notify.show('Logout successful!', 'success');
    this.router.navigate(['/']);
  }
}
