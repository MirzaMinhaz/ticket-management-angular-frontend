import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { getUserRole } from '../../utils/auth.utils';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  imports: [FormsModule, CommonModule, RouterLink],
})
export class AuthComponent {
  isLogin = true;
  showPassword = false;
  // rememberPassword = false;
  rememberPassword: boolean = true;

  loginData = { username: '', password: '' };
  registerData = { username: '', email: '', password: '' };

  constructor(
    private http: HttpClient,
    private router: Router,
    private notify: NotificationService,
  ) {}

  switchTab(login: boolean) {
    this.isLogin = login;
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  // onLogin() {
  //   this.http.post('https://localhost:7139/api/Auth/login', this.loginData)
  //     .subscribe({
  //       next: (res: any) => {
  //         localStorage.setItem('jwtToken', res.token);
  //         localStorage.setItem('username', res.username); // assuming backend sends it

  //         this.notify.show('Login successful!', 'success');
  //         this.router.navigate(['/home']);
  //       },
  //       error: err => {
  //         // ✅ Show friendly message instead of raw stack trace
  //         let msg = 'Incorrect username or password';
  //         if (err.status === 0) {
  //           msg = 'Server unreachable. Please try again later.';
  //         }
  //         this.notify.show(msg, 'error');
  //       }
  //     });
  // }

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

        if (role !== 'Admin') {
          this.notify.show('This portal is for Admin staff only.', 'error');
          this.loading = false;
          return; // ❌ do NOT store token, do NOT navigate
        }

        // ✅ Only Admins reach here
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

  onRegister() {
    this.http
      .post('https://localhost:7139/api/Auth/register', this.registerData)
      .subscribe({
        next: () => {
          this.notify.show('Registration successful!', 'success');
          this.registerData = { username: '', email: '', password: '' };
        },
        error: (err) => {
          const msg = err.error || 'Registration failed';
          this.notify.show(msg, 'error');
        },
      });
  }
}
