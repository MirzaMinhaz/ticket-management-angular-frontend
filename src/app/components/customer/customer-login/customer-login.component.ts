import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './customer-login.component.html',
  styleUrls: ['./customer-login.component.css'],
})
export class CustomerLoginComponent {
  isLogin = true;
  showPassword = false;
  rememberPassword = true;
  loading = false;

  loginData = { username: '', password: '' };
  registerData = { username: '', email: '', password: '', confirmPassword: '' };

  constructor(
    private http: HttpClient,
    private router: Router,
    private notify: NotificationService,
  ) {}

  switchTab(login: boolean) {
    this.isLogin = login;
    this.showPassword = false;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.notify.show('Please fill in all fields.', 'error');
      return;
    }

    this.loading = true;
    this.http
      .post(`${environment.apiUrl}/Auth/login-customer`, {
        username: this.loginData.username,
        password: this.loginData.password,
      })
      .subscribe({
        next: (res: any) => {
          // Server (LoginAsync) has already verified this is a Customer
          // account — no client-side role decoding/check needed anymore.
          localStorage.setItem('jwtToken', res.token);
          localStorage.setItem('username', res.username);
          localStorage.setItem('lastActivity', Date.now().toString());
          this.notify.show('Welcome back, ' + res.username + '!', 'success');
          this.loading = false;
          this.router.navigate(['/customer/home']);
        },
        error: (err) => {
          let msg = 'Incorrect username or password.';

          if (err.status === 0) {
            msg = 'Server unreachable. Try again later.';
          } else if (err.status === 403) {
            msg = err.error || 'This portal is for customers only.';
          } else if (err.status === 429) {
            msg =
              'Too many login attempts. Please wait a few minutes and try again.';
          } else if (err.status === 401) {
            msg = 'Incorrect username or password.';
          }

          this.notify.show(msg, 'error');
          this.loading = false;
        },
      });
  }

  onRegister() {
    if (
      !this.registerData.username ||
      !this.registerData.email ||
      !this.registerData.password
    ) {
      this.notify.show('Please fill in all fields.', 'error');
      return;
    }
    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.notify.show('Passwords do not match.', 'error');
      return;
    }
    if (this.registerData.password.length < 6) {
      this.notify.show('Password must be at least 6 characters.', 'error');
      return;
    }

    this.loading = true;
    this.http
      .post(`${environment.apiUrl}/Auth/register-customer`, {
        username: this.registerData.username,
        email: this.registerData.email,
        password: this.registerData.password,
      })
      .subscribe({
        next: () => {
          this.notify.show('Account created! You can now login.', 'success');
          this.registerData = {
            username: '',
            email: '',
            password: '',
            confirmPassword: '',
          };
          this.isLogin = true;
          this.loading = false;
        },
        error: (err) => {
          const msg =
            typeof err.error === 'string'
              ? err.error
              : 'Registration failed. Try a different username or email.';
          this.notify.show(msg, 'error');
          this.loading = false;
        },
      });
  }
}
