import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-customer-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './customer-profile.component.html',
  styleUrls: ['./customer-profile.component.css']
})
export class CustomerProfileComponent implements OnInit {
  username: string | null = null;
  email: string = 'Not available';
  joinDate: string = '—';

  ngOnInit() {
    this.username = localStorage.getItem('username');
    // Placeholder values until you wire a /api/Users/me endpoint
  }

  getInitial(): string {
    return this.username?.charAt(0)?.toUpperCase() ?? '?';
  }
}