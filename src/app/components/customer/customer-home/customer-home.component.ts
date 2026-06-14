import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-customer-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="ch-wrap">
      <h2>Where do you want to go?</h2>
      <p>Select a ticket type to start your journey.</p>
      <div class="ch-cards">
        <a routerLink="/customer/bus-booking" class="ch-card bus">
          <span>🚌</span> Bus Tickets
        </a>
        <a routerLink="/customer/train-booking" class="ch-card train">
          <span>🚆</span> Train Tickets
        </a>
      </div>
    </div>
  `,
  styles: [`
    .ch-wrap { text-align: center; padding: 4rem 1rem; }
    h2 { font-size: 2rem; color: #1a1a2e; margin-bottom: .5rem; }
    p { color: #666; margin-bottom: 2.5rem; }
    .ch-cards { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; }
    .ch-card {
      display: flex; align-items: center; gap: .75rem;
      padding: 2rem 3rem; border-radius: 14px; text-decoration: none;
      font-size: 1.1rem; font-weight: 700; color: #fff;
      transition: transform .2s, box-shadow .2s;
      box-shadow: 0 4px 20px rgba(0,0,0,.12);
    }
    .ch-card span { font-size: 2rem; }
    .ch-card:hover { transform: translateY(-4px); box-shadow: 0 10px 30px rgba(0,0,0,.18); }
    .bus   { background: linear-gradient(135deg, #f0a500, #e67e22); }
    .train { background: linear-gradient(135deg, #1a1a2e, #0f3460); }
  `]
})
export class CustomerHomeComponent {}