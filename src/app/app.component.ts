import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { NotificationService } from './services/notification.service';
import { getUserRole } from './utils/auth.utils';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  notification: string | null = null;
  notificationType: 'success' | 'error' | null = null;

  constructor(private router: Router, private notify: NotificationService) {
    this.notify.message$.subscribe(msg => this.notification = msg);
    this.notify.type$.subscribe(type => this.notificationType = type);
    this.setupActivityListener();
    this.checkSessionInterval();
  }

  setupActivityListener() {
    const updateActivity = () => localStorage.setItem('lastActivity', Date.now().toString());
    ['click', 'mousemove', 'keydown'].forEach(evt =>
      window.addEventListener(evt, updateActivity)
    );
    updateActivity();
  }

  checkSessionInterval() {
    setInterval(() => {
      const lastActivity = Number(localStorage.getItem('lastActivity') || 0);
      const now = Date.now();
      const THIRTY_MINUTES = 30 * 60 * 1000;
      if (lastActivity && now - lastActivity > THIRTY_MINUTES) {
        const role = getUserRole();
        localStorage.clear();
        this.notify.show('Session expired. Please login again.', 'error');
        this.router.navigate([role === 'Customer' ? '/customer/login' : '/']);
      }
    }, 60 * 1000);
  }

  closeNotification() {
    this.notify.clear();
  }
}