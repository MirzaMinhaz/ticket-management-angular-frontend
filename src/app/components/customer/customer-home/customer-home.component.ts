import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-customer-home',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './customer-home.component.html',
  styleUrls: ['./customer-home.component.css']
})
export class CustomerHomeComponent {
  currentYear = new Date().getFullYear();

  destinations = [
    { name: 'Chattagram', routes: '38 routes', img: 'assets/img/bus_ctg.jpeg', tag: 'Most Popular' },
    { name: "Cox's Bazar", routes: '12 routes', img: 'assets/img/bus_cox_4.jpeg', tag: null },
    { name: 'Rajshahi', routes: '9 routes', img: 'assets/img/bus_raj.jpeg', tag: null },
    { name: 'Sylhet', routes: '11 routes', img: 'assets/img/bus_syl.jpeg', tag: null }
  ];

  testimonials = [
    {
      quote: "Booked my Cox's Bazar trip in literally two minutes. Didn't think buying a bus ticket could feel this easy.",
      name: 'Rahim Uddin',
      loc: 'Dhaka',
      avatar: 'R',
      large: true
    },
    {
      quote: 'Seat selection actually worked exactly how it showed on screen. No surprises at the counter.',
      name: 'Ayesha Khanam',
      loc: 'Chattagram',
      avatar: 'A',
      large: false
    },
    {
      quote: 'Cancelled a ticket last minute and got my refund without any back-and-forth. Big relief.',
      name: 'Karim Molla',
      loc: 'Sylhet',
      avatar: 'K',
      large: false
    }
  ];
}