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
  registerData = { username: '', email: '', phone: '', password: '' };

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
    this.loading = true;
    this.http.post('https://localhost:7139/api/Auth/login', this.loginData)
      .subscribe({
        next: (res: any) => {
          localStorage.setItem('jwtToken', res.token);
          localStorage.setItem('username', res.username);
          localStorage.setItem('lastActivity', Date.now().toString());
          const role = getUserRole();
          if (role === 'Customer') {
            this.notify.show('Login successful!', 'success');
            this.router.navigate(['/customer/home']);
          } else {
            this.notify.show('This portal is for customers only.', 'error');
            localStorage.clear();
          }
          this.loading = false;
        },
        error: err => {
          this.notify.show(
            err.status === 0 ? 'Server unreachable.' : 'Incorrect username or password.',
            'error'
          );
          this.loading = false;
        }
      });
  }

  onRegister() {
    this.loading = true;
    this.http.post('https://localhost:7139/api/Auth/register', this.registerData)
      .subscribe({
        next: () => {
          this.notify.show('Account created! Please login.', 'success');
          this.registerData = { username: '', email: '', phone: '', password: '' };
          this.isLogin = true;
          this.loading = false;
        },
        error: err => {
          this.notify.show(err.error || 'Registration failed.', 'error');
          this.loading = false;
        }
      });
  }
}