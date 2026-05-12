import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  imports: [FormsModule, CommonModule]
})
export class AuthComponent {
  isLogin = true;
  showPassword = false;
  // rememberPassword = false;
  rememberPassword: boolean = true;


  loginData = { username: '', password: '' };
  registerData = { username: '', email: '', password: '' };

  constructor(private http: HttpClient, private router: Router, private notify: NotificationService) { }

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
  this.loading = true; // start spinner
  this.http.post('https://localhost:7139/api/Auth/login', this.loginData)
    .subscribe({
      next: (res: any) => {
        localStorage.setItem('jwtToken', res.token);
        localStorage.setItem('username', res.username);
        // ✅ Start session activity tracking
        localStorage.setItem('lastActivity', Date.now().toString());

        this.notify.show('Login successful!', 'success');
        this.router.navigate(['/home']);
        this.loading = false; // stop spinner
      },
      error: err => {
        let msg = 'Incorrect username or password';
        if (err.status === 0) {
          msg = 'Server unreachable. Please try again later.';
        }
        this.notify.show(msg, 'error');
        this.loading = false; // stop spinner
      }
    });
}



  onRegister() {
    this.http.post('https://localhost:7139/api/Auth/register', this.registerData)
      .subscribe({
        next: () => {
          this.notify.show('Registration successful!', 'success');
          this.registerData = { username: '', email: '', password: '' };
        },
        error: err => {
          const msg = err.error || 'Registration failed';
          this.notify.show(msg, 'error');
        }
      });
  }



  
}
