import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TicketDto, TripDto, ScheduleDto, RouteDto, Vehicle } from '../../../models/common';
import { TicketService } from '../../../services/ticket.service';
import { TripService } from '../../../services/trip.service';
import { ScheduleService } from '../../../services/schedule.service';
import { RouteService } from '../../../services/route.service';
import { VehicleService } from '../../../services/vehicle.service';

@Component({
  selector: 'app-customer-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './customer-my-tickets.component.html',
  styleUrls: ['./customer-my-tickets.component.css']
})
export class CustomerMyTicketsComponent implements OnInit {
  tickets: TicketDto[] = [];
  loading = true;
  error = false;

  private trips: TripDto[] = [];
  private schedules: ScheduleDto[] = [];
  private routes: RouteDto[] = [];
  private vehicles: Vehicle[] = [];

  constructor(
    private ticketService: TicketService,
    private tripService: TripService,
    private scheduleService: ScheduleService,
    private routeService: RouteService,
    private vehicleService: VehicleService
  ) {}

  ngOnInit(): void {
    forkJoin({
      tickets: this.ticketService.getMyTickets(),
      trips: this.tripService.getAll(),
      schedules: this.scheduleService.getAllSchedules(),
      routes: this.routeService.getAllRoutes(),
      vehicles: this.vehicleService.getAll()
    }).subscribe({
      next: ({ tickets, trips, schedules, routes, vehicles }) => {
        this.trips = trips;
        this.schedules = schedules;
        this.routes = routes;
        this.vehicles = vehicles;
        this.tickets = tickets.sort(
          (a, b) => new Date(b.bookingDateTime).getTime() - new Date(a.bookingDateTime).getTime()
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load tickets:', err);
        this.loading = false;
        this.error = true;
      }
    });
  }

  getRouteName(tripId: number): string {
    const trip = this.trips.find(t => t.id === tripId);
    const schedule = this.schedules.find(s => s.id === trip?.scheduleId);
    return this.routes.find(r => r.id === schedule?.routeId)?.routeName ?? 'Route unavailable';
  }

  getVehicleModel(tripId: number): string {
    const trip = this.trips.find(t => t.id === tripId);
    const schedule = this.schedules.find(s => s.id === trip?.scheduleId);
    return this.vehicles.find(v => v.id === schedule?.vehicleId)?.model ?? '';
  }

  getVehicleType(tripId: number): 'Bus' | 'Train' {
    const trip = this.trips.find(t => t.id === tripId);
    const schedule = this.schedules.find(s => s.id === trip?.scheduleId);
    const type = this.vehicles.find(v => v.id === schedule?.vehicleId)?.type;
    return type === 'Train' ? 'Train' : 'Bus';
  }

  getSeatList(seatNumber: string | null | undefined): string[] {
  return seatNumber ? seatNumber.split(',').map(s => s.trim()) : [];
}

  isUpcoming(bookingDateTime: string): boolean {
    return new Date(bookingDateTime).getTime() >= new Date().setHours(0, 0, 0, 0);
  }
}