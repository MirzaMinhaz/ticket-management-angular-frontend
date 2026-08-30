import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';

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

  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private notify: NotificationService,
  ) {}

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    // Stop blank/whitespace-only submissions before they ever hit the API —
    // this is what was producing the empty "Login attempt for Username: " log lines.
    const username = this.loginData.username?.trim();
    const password = this.loginData.password?.trim();

    if (!username || !password) {
      this.notify.show('Please enter both username and password.', 'error');
      return;
    }

    this.loading = true;
    this.http
      .post(`${environment.apiUrl}/Auth/login`, { username, password })
      .subscribe({
        next: (res: any) => {
          // Server has already verified this user is allowed into the
          // staff portal (LoginStaffAsync). No client-side role check needed.
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
          } else if (err.status === 403) {
            msg = err.error || 'This portal is for staff accounts only.';
          } else if (err.status === 401) {
            msg = 'Incorrect username or password';
          } else if (err.status === 429) {
            msg ='Too many login attempts. Please wait a few minutes and try again.';
          } else if (err.status === 400) {
            msg = 'Please enter both username and password.';
          }

          this.notify.show(msg, 'error');
          this.loading = false;
        },
      });
  }
}
