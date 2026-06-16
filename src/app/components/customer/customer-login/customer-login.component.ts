import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../../services/notification.service';
import { getUserRole } from '../../../utils/auth.utils';

@Component({
  selector: 'app-customer-login',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './customer-login.component.html',
  styleUrls: ['./customer-login.component.css']
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
    private notify: NotificationService
  ) {}

  switchTab(login: boolean) {
    this.isLogin = login;
    this.showPassword = false;
  }

  togglePassword() { this.showPassword = !this.showPassword; }

  onLogin() {
    if (!this.loginData.username || !this.loginData.password) {
      this.notify.show('Please fill in all fields.', 'error');
      return;
    }

    this.loading = true;
    this.http.post('https://localhost:7139/api/Auth/login', {
      username: this.loginData.username,
      password: this.loginData.password
    }).subscribe({
      next: (res: any) => {
        localStorage.setItem('jwtToken', res.token);
        localStorage.setItem('username', res.username);
        localStorage.setItem('lastActivity', Date.now().toString());

        const role = getUserRole();
        if (role === 'Customer') {
          this.notify.show('Welcome back, ' + res.username + '!', 'success');
          this.router.navigate(['/customer/home']);
        } else {
          // Admin accidentally used customer login
          this.notify.show('Please use the Admin login portal.', 'error');
          localStorage.clear();
        }
        this.loading = false;
      },
      error: err => {
        this.notify.show(
          err.status === 0 ? 'Server unreachable. Try again later.' : 'Incorrect username or password.',
          'error'
        );
        this.loading = false;
      }
    });
  }

  onRegister() {
  if (!this.registerData.username || !this.registerData.email || !this.registerData.password) {
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
  this.http.post('https://localhost:7139/api/Auth/register-customer', {
    username: this.registerData.username,
    email: this.registerData.email,
    password: this.registerData.password
  }).subscribe({
    next: () => {
      this.notify.show('Account created! You can now login.', 'success');
      this.registerData = { username: '', email: '', password: '', confirmPassword: '' };
      this.isLogin = true;
      this.loading = false;
    },
    error: err => {
      const msg = typeof err.error === 'string' ? err.error : 'Registration failed. Try a different username or email.';
      this.notify.show(msg, 'error');
      this.loading = false;
    }
  });
}
}