import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

// Roles allowed into this portal. Customers are rejected here — they use
// the separate customer login flow.
const STAFF_PORTAL_ROLES = ['Admin', 'Manager', 'StationAgent', 'CounterAgent'];

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  imports: [FormsModule, CommonModule, RouterLink],
})
export class AuthComponent {
  showPassword = false;
  rememberPassword: boolean = true;

  loginData = { username: '', password: '' };

  constructor(
    private http: HttpClient,
    private router: Router,
    private notify: NotificationService,
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  loading = false;

  onLogin() {
    this.loading = true;
    this.http
      .post('https://localhost:7139/api/Auth/login', this.loginData)
      .subscribe({
        next: (res: any) => {
          const tempToken = res.token;
          const payload = JSON.parse(atob(tempToken.split('.')[1]));
          const role = payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];

          if (!STAFF_PORTAL_ROLES.includes(role)) {
            this.notify.show('This portal is for staff accounts only.', 'error');
            this.loading = false;
            return; // ❌ do NOT store token, do NOT navigate
          }

          // ✅ Only staff roles reach here
          localStorage.setItem('jwtToken', res.token);
          localStorage.setItem('username', res.username);
          localStorage.setItem('lastActivity', Date.now().toString());
          this.notify.show('Login successful!', 'success');
          this.loading = false;
          this.router.navigate(['/home']);
        },
        error: (err) => {
          let msg = 'Incorrect username or password';
          if (err.status === 0) {
            msg = 'Server unreachable. Please try again later.';
          }
          this.notify.show(msg, 'error');
          this.loading = false;
        },
      });
  }
}