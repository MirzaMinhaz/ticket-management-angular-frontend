import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

interface RoleOption {
  value: string;
  label: string;
  desc: string;
  color: string;
}

@Component({
  selector: 'app-user-registration',
  standalone: true,
  templateUrl: './user-registration.component.html',
  styleUrls: ['./user-registration.component.css'],
  imports: [FormsModule, CommonModule],
})
export class UserRegistrationComponent {
  // Kept in sync with TMS.Domain.Constants.Roles.AssignableStaffRoles on the
  // backend — Admin is intentionally excluded, same reasoning as the API.
  roles: RoleOption[] = [
    { value: 'Manager', label: 'Manager', desc: 'Regional oversight & reports', color: '#0d9488' },
    { value: 'StationAgent', label: 'Station Agent', desc: 'Train ticketing only', color: '#b45309' },
    { value: 'CounterAgent', label: 'Counter Agent', desc: 'Bus ticketing only', color: '#be123c' },
  ];

  formData = { username: '', email: '', password: '', role: '' };
  showPassword = false;
  loading = false;

  constructor(
    private http: HttpClient,
    private notify: NotificationService,
  ) {}

  get selectedRoleLabel(): string {
    return this.roles.find(r => r.value === this.formData.role)?.label ?? '';
  }

  get selectedRoleColor(): string {
    return this.roles.find(r => r.value === this.formData.role)?.color ?? '#94a3b8';
  }

  get stubCode(): string {
    // Purely cosmetic placeholder shown on the live preview before the real
    // UserCode is issued by the backend on submit.
    return this.formData.username
      ? this.formData.username.slice(0, 4).toUpperCase().padEnd(4, 'X')
      : '----';
  }

  onRegister() {
    if (!this.formData.role) {
      this.notify.show('Select a role before issuing credentials.', 'error');
      return;
    }

    this.loading = true;
    // Auth interceptor is expected to attach the Admin's Bearer token —
    // this endpoint is [Authorize(Roles = "Admin")] on the backend.
    this.http
      .post('https://localhost:7139/api/Auth/register-staff', this.formData)
      .subscribe({
        next: () => {
          this.notify.show(`${this.selectedRoleLabel} account created for ${this.formData.username}.`, 'success');
          this.formData = { username: '', email: '', password: '', role: '' };
          this.loading = false;
        },
        error: (err) => {
          const msg = err.error || 'Could not create the account. Please check the details and try again.';
          this.notify.show(msg, 'error');
          this.loading = false;
        },
      });
  }
}