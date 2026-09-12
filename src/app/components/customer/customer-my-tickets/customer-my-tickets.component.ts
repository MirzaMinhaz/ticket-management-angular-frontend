import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  TicketDto,
  TripDto,
  ScheduleDto,
  RouteDto,
  Vehicle,
  CancelTicketDto,
} from '../../../models/common';
import { TicketService } from '../../../services/ticket.service';
import { TripService } from '../../../services/trip.service';
import { ScheduleService } from '../../../services/schedule.service';
import { RouteService } from '../../../services/route.service';
import { VehicleService } from '../../../services/vehicle.service';
import { OperatorDto } from '../../../models/common';
import { OperatorService } from '../../../services/operators.service';

type TicketFilter = 'all' | 'upcoming' | 'past' | 'cancelled';

// Add near the top of the file, above the @Component decorator
const BRAND_LOGOS: Record<string, string> = {
  scania: 'assets/img/scania.jpeg',
  volvo: 'assets/img/volvo.jpeg',
  hino: 'assets/img/hino.jpeg',
  mercedes: 'assets/img/mercedes.jpeg',
  man: 'assets/img/man.jpeg',
  isuzu: 'assets/img/isuzu.jpeg',
  yutong: 'assets/img/yutong.jpeg',
  king: 'assets/img/king.jpeg',
  golden: 'assets/img/golden.jpeg',
  zhongtong: 'assets/img/zhongtong.jpeg',
  daf: 'assets/img/daf.jpeg',
  tata: 'assets/img/tata.jpeg',
  ashok: 'assets/img/ashok.jpeg',
  leyland: 'assets/img/ashok.jpeg',
  eicher: 'assets/img/eicher.jpeg',
  byd: 'assets/img/byd.jpeg',
  neoplan: 'assets/img/neoplan.jpeg',
  setra: 'assets/img/setra.jpeg',
  irizar: 'assets/img/irizar.jpeg',
  hyundai: 'assets/img/hyundai.jpeg',
  br: 'assets/img/br.jpeg',
  caetano: 'assets/img/caetano.jpeg',
};

@Component({
  selector: 'app-customer-my-tickets',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './customer-my-tickets.component.html',
  styleUrls: ['./customer-my-tickets.component.css'],
})
export class CustomerMyTicketsComponent implements OnInit {
  tickets: TicketDto[] = [];
  loading = true;
  error = false;

  private trips: TripDto[] = [];
  private schedules: ScheduleDto[] = [];
  private routes: RouteDto[] = [];
  private vehicles: Vehicle[] = [];
  private operators: OperatorDto[] = [];

  // ── Tab filter ───────────────────────────────────────────────────────────────
  activeFilter: TicketFilter = 'all';

  // ── Cancel modal state ───────────────────────────────────────────────────────
  showCancelConfirmModal = false;
  ticketToCancel: TicketDto | null = null;
  cancelReason: string = 'Passenger request';
  cancelling = false;

  // ── Toast ─────────────────────────────────────────────────────────────────────
  toasts: {
    id: number;
    type: 'success' | 'error' | 'warn' | 'info';
    message: string;
  }[] = [];
  private _toastId = 0;

  constructor(
    private ticketService: TicketService,
    private tripService: TripService,
    private scheduleService: ScheduleService,
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
  }

  private loadAll(): void {
    this.loading = true;
    this.error = false;
    forkJoin({
      tickets: this.ticketService.getMyTickets(),
      trips: this.tripService.getAll(),
      schedules: this.scheduleService.getAllSchedules(),
      routes: this.routeService.getAllRoutes(),
      vehicles: this.vehicleService.getAll(),
      operators: this.operatorService.getAll(),
    }).subscribe({
      next: ({ tickets, trips, schedules, routes, vehicles, operators }) => {
        this.trips = trips;
        this.schedules = schedules;
        this.routes = routes;
        this.vehicles = vehicles;
        this.operators = operators;
        this.tickets = tickets.sort(
          (a, b) =>
            new Date(b.bookingDateTime).getTime() -
            new Date(a.bookingDateTime).getTime(),
        );
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load tickets:', err);
        this.loading = false;
        this.error = true;
      },
    });
  }

  // ── Lookups ───────────────────────────────────────────────────────────────────

  getRouteName(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    const schedule = this.schedules.find((s) => s.id === trip?.scheduleId);
    return (
      this.routes.find((r) => r.id === schedule?.routeId)?.routeName ??
      'Route unavailable'
    );
  }

  getVehicleModel(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    const schedule = this.schedules.find((s) => s.id === trip?.scheduleId);
    return this.vehicles.find((v) => v.id === schedule?.vehicleId)?.model ?? '';
  }

  // getOperatorName(tripId: number): string {
  //   const trip = this.trips.find((t) => t.id === tripId);
  //   const schedule = this.schedules.find((s) => s.id === trip?.scheduleId);
  //   const vehicle = this.vehicles.find((v) => v.id === schedule?.vehicleId);
  //   return (
  //     this.operators.find((o) => o.operatorCode === vehicle?.operatorCode)
  //       ?.name ?? ''
  //   );
  // }

  getOperatorName(tripId: number): string {
  const trip = this.trips.find(t => t.id === tripId);
  const schedule = this.schedules.find(s => s.id === trip?.scheduleId);
  const vehicle = this.vehicles.find(v => v.id === schedule?.vehicleId);
  if (!vehicle) return '';

  return (
    this.operators.find(o => o.operatorCode === vehicle.operatorCode)?.name ??
    this.operators.find(o => o.id === vehicle.operatorId)?.name ??
    ''
  );
}

  getVehicleType(tripId: number): 'Bus' | 'Train' {
    const trip = this.trips.find((t) => t.id === tripId);
    const schedule = this.schedules.find((s) => s.id === trip?.scheduleId);
    const type = this.vehicles.find((v) => v.id === schedule?.vehicleId)?.type;
    return type === 'Train' ? 'Train' : 'Bus';
  }

  // ── Brand Logo Helpers ───────────────────────────────────────────────────────

  getBrandLogo(model: string): string | null {
    if (!model) return null;
    const lower = model.toLowerCase();
    for (const [key, path] of Object.entries(BRAND_LOGOS)) {
      if (lower.includes(key)) return path;
    }
    return null;
  }

  getBrandName(model: string): string {
    if (!model) return '';
    const lower = model.toLowerCase();
    for (const key of Object.keys(BRAND_LOGOS)) {
      if (lower.includes(key))
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
    return '';
  }

  getBrandInitial(model: string): string {
    return model ? model.charAt(0).toUpperCase() : '?';
  }

  getSeatList(seatNumber: string | null | undefined): string[] {
    return seatNumber ? seatNumber.split(',').map((s) => s.trim()) : [];
  }

  /** Travel date is genuinely today-or-later — used to decide upcoming vs past. */
  isUpcoming(bookingDateTime: string): boolean {
    return (
      new Date(bookingDateTime).getTime() >= new Date().setHours(0, 0, 0, 0)
    );
  }

  /** A ticket can be cancelled only if it hasn't been travelled yet and isn't already cancelled. */
  isCancellable(t: TicketDto): boolean {
    return t.status !== 'Cancelled' && this.isUpcoming(t.bookingDateTime);
  }

  // ── Filter tabs ──────────────────────────────────────────────────────────────

  setFilter(filter: TicketFilter): void {
    this.activeFilter = filter;
  }

  get filteredTickets(): TicketDto[] {
    switch (this.activeFilter) {
      case 'upcoming':
        return this.tickets.filter(
          (t) => t.status !== 'Cancelled' && this.isUpcoming(t.bookingDateTime),
        );
      case 'past':
        return this.tickets.filter(
          (t) =>
            t.status !== 'Cancelled' && !this.isUpcoming(t.bookingDateTime),
        );
      case 'cancelled':
        return this.tickets.filter((t) => t.status === 'Cancelled');
      default:
        return this.tickets;
    }
  }

  get upcomingCount(): number {
    return this.tickets.filter(
      (t) => t.status !== 'Cancelled' && this.isUpcoming(t.bookingDateTime),
    ).length;
  }
  get pastCount(): number {
    return this.tickets.filter(
      (t) => t.status !== 'Cancelled' && !this.isUpcoming(t.bookingDateTime),
    ).length;
  }
  get cancelledCount(): number {
    return this.tickets.filter((t) => t.status === 'Cancelled').length;
  }

  // ── Cancel flow ──────────────────────────────────────────────────────────────

  openCancelConfirm(t: TicketDto): void {
    if (!this.isCancellable(t)) return;
    this.ticketToCancel = t;
    this.cancelReason = 'Passenger request';
    this.showCancelConfirmModal = true;
  }

  closeCancelConfirm(): void {
    if (this.cancelling) return;
    this.showCancelConfirmModal = false;
    this.ticketToCancel = null;
  }

  confirmCancel(): void {
    if (!this.ticketToCancel) return;
    this.cancelling = true;

    const dto: CancelTicketDto = {
      id: this.ticketToCancel.id,
      reason: this.cancelReason,
    };

    this.ticketService.cancelTicket(dto).subscribe({
      next: () => {
        const idx = this.tickets.findIndex((t) => t.id === dto.id);
        if (idx !== -1)
          this.tickets[idx] = { ...this.tickets[idx], status: 'Cancelled' };
        this.cancelling = false;
        this.showCancelConfirmModal = false;
        this.ticketToCancel = null;
        this.showToast('success', 'Your ticket has been cancelled.');
      },
      error: (err) => {
        console.error('Cancel failed:', err);
        this.cancelling = false;
        this.showToast(
          'error',
          'Could not cancel this ticket. Please try again.',
        );
      },
    });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────

  showToast(
    type: 'success' | 'error' | 'warn' | 'info',
    message: string,
    durationMs = 3000,
  ): void {
    const id = ++this._toastId;
    this.toasts.push({ id, type, message });
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  trackToast(_: number, toast: { id: number }): number {
    return toast.id;
  }

  trackTicket(_: number, t: TicketDto): number {
    return t.id;
  }
}
