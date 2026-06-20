import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-customer-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './customer-my-tickets.component.html',
  styleUrls: ['./customer-my-tickets.component.css']
})
export class CustomerMyTicketsComponent {
  // Placeholder — wire to a real /api/Tickets/my endpoint later
  tickets: any[] = [];
}