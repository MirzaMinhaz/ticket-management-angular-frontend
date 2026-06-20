import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserProfileDto } from '../../../models/common';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.css']
})
export class CustomerProfileComponent implements OnInit {
  profile: UserProfileDto | null = null;
  loading = true;
  error = false;
  copied = false;

  constructor(private userService: UserService) {}

  ngOnInit(): void {
    this.userService.getMyProfile().subscribe({
      next: (data) => {
        this.profile = data;
        this.loading = false;
      },
      error: () => {
        // Fallback so the page still shows *something* instead of breaking
        const fallbackUsername = localStorage.getItem('username');
        if (fallbackUsername) {
          this.profile = {
            id: 0,
            username: fallbackUsername,
            email: 'Not available',
            role: 'Customer',
            userCode: '',
            createdAt: new Date().toISOString()
          };
        }
        this.loading = false;
        this.error = true;
      }
    });
  }

  get initial(): string {
    return this.profile?.username?.charAt(0)?.toUpperCase() ?? '?';
  }

  get joinDate(): string {
    if (!this.profile?.createdAt) return '—';
    return new Date(this.profile.createdAt).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  }

  get memberDuration(): string {
    if (!this.profile?.createdAt) return '';
    const created = new Date(this.profile.createdAt).getTime();
    const days = Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24));

    if (days < 1) return 'Joined today';
    if (days === 1) return 'Member for 1 day';
    if (days < 30) return `Member for ${days} days`;
    if (days < 365) {
      const months = Math.floor(days / 30);
      return `Member for ${months} month${months > 1 ? 's' : ''}`;
    }
    const years = Math.floor(days / 365);
    return `Member for ${years} year${years > 1 ? 's' : ''}`;
  }

  get shortCode(): string {
    return this.profile?.userCode ? this.profile.userCode.split('-')[0].toUpperCase() : '';
  }

  copyUserCode(): void {
    if (!this.profile?.userCode) return;
    navigator.clipboard.writeText(this.profile.userCode).then(() => {
      this.copied = true;
      setTimeout(() => (this.copied = false), 1800);
    });
  }
}