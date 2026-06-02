import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { NotificationService } from './services/notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  notification: string | null = null;
  notificationType: 'success' | 'error' | null = null;
  mobileMenuOpen = false;

  constructor(private router: Router, private notify: NotificationService) {
    this.notify.message$.subscribe(msg => this.notification = msg);
    this.notify.type$.subscribe(type => this.notificationType = type);
    this.setupActivityListener();
    this.checkSessionInterval();
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
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
        this.logout();
      }
    }, 60 * 1000);
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