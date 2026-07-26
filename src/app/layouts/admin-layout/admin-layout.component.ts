import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent {
  mobileMenuOpen = false;

  constructor(private router: Router) {}

  toggleMobileMenu() { this.mobileMenuOpen = !this.mobileMenuOpen; }

  getLoggedInUser(): string | null {
    return localStorage.getItem('username');
  }

  isAdminOrManager(): boolean {
    const username = this.getLoggedInUser();
    if (!username) return false;
    const lower = username.toLowerCase();
    return lower.includes('admin') || lower.includes('manager');
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}