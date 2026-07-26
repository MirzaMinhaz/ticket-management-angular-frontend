// src/app/home/home.component.ts
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  standalone: true,
  imports: [RouterModule],
})
export class HomeComponent { 


  currentYear: number = new Date().getFullYear();

  scrollToFaq(): void {
    document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
  }

}