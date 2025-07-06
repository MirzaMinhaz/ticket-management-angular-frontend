// src/app/app.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true, // This is a standalone component
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive], // Import necessary modules
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ticket-management-angular-frontend';
}