import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CustomerFooterComponent } from '../../components/customer/customer-footer/customer-footer.component';

@Component({
  selector: 'app-customer-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive,CustomerFooterComponent],
  templateUrl: './customer-layout.component.html',
  styleUrls: ['./customer-layout.component.css']
})
export class CustomerLayoutComponent {
  menuOpen = false;
  username = localStorage.getItem('username') ?? 'User';
  constructor(private router: Router) {}
  toggleMenu() { this.menuOpen = !this.menuOpen; }
  logout() { localStorage.clear(); this.router.navigate(['/customer/login']); }
}