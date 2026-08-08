import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router } from '@angular/router';
import { NotificationService } from './services/notification.service';
import {
  getUserRole,
  hasRole,
  listenForCrossTabLogout,
  listenForCrossTabLogin
} from './utils/auth.utils';

const STAFF_ROLES = ['Admin', 'Manager', 'StationAgent', 'CounterAgent'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  notification: string | null = null;
  notificationType: 'success' | 'error' | null = null;

  constructor(private router: Router, private notify: NotificationService) {
    this.notify.message$.subscribe(msg => this.notification = msg);
    this.notify.type$.subscribe(type => this.notificationType = type);
    this.setupActivityListener();
    this.checkSessionInterval();
  }

  ngOnInit(): void {
    listenForCrossTabLogout(() => {
      // Another tab logged out. Force this tab to the login page immediately,
      // regardless of what page it's currently sitting on.
      this.router.navigate(['/']).then(() => {
        // Optional: surface a message so the user understands why they were
        // bumped, rather than it looking like a random redirect.
        window.location.reload(); // ensures any in-memory component state
                                   // (like an open form) is fully torn down
      });
    });

    listenForCrossTabLogin((role: string | null) => {
      // Only redirect this tab if it's idle on a login/auth page.
      // An already-logged-in tab must not be touched.
      const currentUrl = this.router.url;
      const isOnAuthPage = currentUrl === '/' || currentUrl.startsWith('/customer/login');

      if (!isOnAuthPage) {
        return;
      }

      // Mirror the guards' own role logic exactly, rather than inferring
      // "not customer therefore staff."
      let landingRoute: string;
      if (STAFF_ROLES.some((r) => hasRole(r))) {
        landingRoute = '/home';
      } else if (role === 'Customer') {
        landingRoute = '/customer/home';
      } else {
        // Unrecognized role — don't guess a destination, let the guards
        // decide where this user belongs.
        landingRoute = '/';
      }

      this.router.navigate([landingRoute]);
    });
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