import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { hasRole, getUserName } from '../../utils/auth.utils'; // adjust path to your actual file

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
    return getUserName();
  }

  isAdminOrManager(): boolean {
    return hasRole('Admin') || hasRole('Manager');
  }

  isStation(): boolean {
    return hasRole('StationAgent');
  }

  isCounter(): boolean {
    return hasRole('CounterAgent');
  }

  // Plain customers (or anyone not admin/manager/station/counter) see both
  isGeneralCustomer(): boolean {
    return !this.isAdminOrManager() && !this.isStation() && !this.isCounter();
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}