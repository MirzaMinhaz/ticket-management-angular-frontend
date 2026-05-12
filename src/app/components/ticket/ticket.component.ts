import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  TicketDto,
  CreateTicketDto,
  UpdateTicketDto,
  RouteDto,
  Vehicle,
  OperatorDto,
  ScheduleDto,
  TicketCounterDto,
  SeatDto,
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketService } from '../../services/ticket.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.css'],
})
export class TicketComponent implements OnInit {
  tickets: TicketDto[] = [];
  paginatedTickets: TicketDto[] = [];
  selectedTicket: TicketDto = this.emptyTicket();

  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  counters: TicketCounterDto[] = [];

  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  selectedCounterCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

  availableVehicles: Vehicle[] = [];

  successMessage: string | null = null;
  modalSuccessMessage: string | null = null;

  showModal = false;
  showDeleteConfirmModal = false;
  ticketToDelete: TicketDto | null = null;

  currentPage = 1;
  itemsPerPage = 25;
  totalPages = 1;
  pages: number[] = [];

  // ── Seat Booking State ────────────────────────────────────────────────────────
  seatBookingBusId: number | null = null;
  seats: SeatDto[] = [];
  seatMap: Record<string, SeatDto> = {};
  selectedSeats: SeatDto[] = [];
  rows: string[] = [];

  /**
   * In-memory registry of already-booked seat numbers keyed by
   * "<vehicleId>|<YYYY-MM-DD>"  (departure date === bookingDateTime).
   *
   * Built once from the full ticket list in loadTickets() and kept up-to-date
   * on create / delete without a round-trip.
   *
   * Example:
   *   bookedSeatRegistry['42|2026-05-15'] = ['D1', 'D2', 'D3']
   */
  private bookedSeatRegistry: Record<string, string[]> = {};

  constructor(
    private ngZone: NgZone,
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ticketCounterService: TicketCounterService,
    private ticketService: TicketService,
  ) {}

  ngOnInit(): void {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    // Load reference data first; loadTickets() depends on vehicles being ready
    // so we chain it after vehicles load (or you can use forkJoin).
    this.loadRoutes();
    this.loadVehicles();      // vehicles must be ready before rebuildBookedSeatRegistry
    this.loadOperators();
    this.loadSchedules();
    this.loadCounters();
    this.loadTickets();       // will rebuild registry once vehicles are populated
    this.updatePagination();
  }

  // ── Load data ────────────────────────────────────────────────────────────────

  loadRoutes(): void {
    this.routeService.getAllRoutes().subscribe({
      next: (data) => (this.routes = data),
      error: (err) => console.error('Failed to load routes', err),
    });
  }

  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: (data) => {
        this.vehicles = data;
        // If tickets arrived before vehicles, rebuild now that vehicles are ready
        if (this.tickets.length) {
          this.rebuildBookedSeatRegistry(this.tickets);
        }
      },
      error: (err) => console.error('Failed to load vehicles', err),
    });
  }

  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: (data) => (this.operators = data),
      error: (err) => console.error('Failed to load operators', err),
    });
  }

  loadSchedules(): void {
    this.scheduleService.getAllSchedules().subscribe({
      next: (data) => (this.schedules = data),
      error: (err) => console.error('Failed to load schedules', err),
    });
  }

  loadCounters(): void {
    this.ticketCounterService.getAllTicketCounters().subscribe({
      next: (data) => (this.counters = data),
      error: (err) => console.error('Failed to load counters', err),
    });
  }

  loadTickets(): void {
    this.ticketService.getTickets().subscribe({
      next: (data) => {
        this.tickets = data;
        this.rebuildBookedSeatRegistry(data);
        this.updatePagination();
      },
      error: (err) => console.error('Failed to load tickets', err),
    });
  }

  // ── Booked-seat registry helpers ─────────────────────────────────────────────

  /**
   * Rebuild the full registry from the entire ticket list.
   * Called after every load / delete so the map is always consistent.
   *
   * TicketDto shape we rely on:
   *   t.seatNumber      – comma-separated seat numbers, e.g. "D1, D2, D3"
   *   t.bookingDateTime – ISO string whose first 10 chars are "YYYY-MM-DD"
   *                       (this equals the departure date per your calculateArrivalDate logic)
   *   t.vehicleId       – preferred; falls back to matching vehicleCode if absent
   */
  private rebuildBookedSeatRegistry(tickets: TicketDto[]): void {
    this.bookedSeatRegistry = {};

    for (const t of tickets) {
      if (!t.seatNumber || !t.bookingDateTime) continue;

      // Resolve the vehicleId
      // Option A – TicketDto already has vehicleId (preferred, add it to your DTO)
      // Option B – TicketDto has vehicleCode, look up via vehicles array
      const vehicleId: number | undefined =
        (t as any).vehicleId ??
        this.vehicles.find((v) => v.vehicleCode === (t as any).vehicleCode)?.id;

      if (!vehicleId) continue;

      // Normalise date to "YYYY-MM-DD"
      const date = t.bookingDateTime.substring(0, 10);
      const key = `${vehicleId}|${date}`;

      const seatNumbers = t.seatNumber
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!this.bookedSeatRegistry[key]) {
        this.bookedSeatRegistry[key] = [];
      }
      this.bookedSeatRegistry[key].push(...seatNumbers);
    }
  }

  /**
   * Returns the list of seat numbers already booked for a specific
   * vehicle on a specific departure date.
   */
  private getBookedSeatsForVehicleOnDate(
    vehicleId: number,
    date: string,            // "YYYY-MM-DD"
  ): string[] {
    const key = `${vehicleId}|${date}`;
    return this.bookedSeatRegistry[key] ?? [];
  }

  /**
   * Returns the number of seats still AVAILABLE for a vehicle on the
   * currently selected departure date.  Falls back to raw capacity when
   * no date is selected yet.
   */
  getAvailableSeatsCount(vehicleId: number): number {
    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    const capacity = vehicle?.capacity ?? 0;

    if (!this.selectedDepartureDate) return capacity;

    const booked = this.getBookedSeatsForVehicleOnDate(
      vehicleId,
      this.selectedDepartureDate,
    ).length;

    return Math.max(0, capacity - booked);
  }

  // ── Template helpers ─────────────────────────────────────────────────────────

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    const op = this.operators.find((o) => o.operatorCode === operatorCode);
    return op ? op.name : '';
  }

  getCounterName(id: number | string | undefined): string {
    if (id === undefined || id === null) return '—';
    const counter = this.counters.find((c) => c.id === Number(id));
    return counter ? counter.counterName : '—';
  }

  calculateArrivalDate(): void {
    if (!this.selectedDepartureDate || !this.selectedRouteCode) return;

    const route = this.routes.find(
      (r) => r.id === Number(this.selectedRouteCode),
    );
    if (!route || !route.estimatedDurationHours) return;

    const departureDate = new Date(this.selectedDepartureDate);
    const arrivalDate = new Date(
      departureDate.getTime() + route.estimatedDurationHours * 60 * 60 * 1000,
    );

    const pad = (n: number) => n.toString().padStart(2, '0');
    this.selectedArrivalDate = `${arrivalDate.getFullYear()}-${pad(arrivalDate.getMonth() + 1)}-${pad(arrivalDate.getDate())}`;

    // Keep Booking Date in sync with Departure Date
    this.selectedTicket.bookingDateTime = this.selectedDepartureDate;

    this.availableVehicles = this.vehicles.filter((v) =>
      this.schedules.some(
        (s) =>
          s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id,
      ),
    );
  }

  fillBaseFare(): void {
    const schedule = this.schedules.find(
      (s) =>
        s.routeId === Number(this.selectedRouteCode) &&
        s.vehicleId ===
          this.vehicles.find((v) => v.vehicleCode === this.selectedVehicleCode)
            ?.id,
    );
    if (schedule) {
      this.selectedBaseFare = schedule.baseFare;
    }
  }

  emptyTicket(): TicketDto {
    return {
      id: 0,
      passengerName: '',
      passengerContact: '',
      seatNumber: '',
      farePaid: 0,
      bookingDateTime: this.getTodayDateString(),
      bookingCounterId: 0,
      departureCounterId: 0,
      arrivalCounterId: 0,
      createdAt: '',
      createdBy: '',
    };
  }

  save(): void {
    if (this.selectedTicket.id) {
      // ── UPDATE ──────────────────────────────────────────────────────────
      const updateRequest: UpdateTicketDto = {
        id: this.selectedTicket.id,
        passengerName: this.selectedTicket.passengerName,
        passengerContact: this.selectedTicket.passengerContact,
        seatNumber: this.selectedTicket.seatNumber,
        farePaid: Number(this.selectedTicket.farePaid),
        bookingDateTime: this.selectedTicket.bookingDateTime,
        bookingCounterId: Number(this.selectedTicket.bookingCounterId),
        departureCounterId: Number(this.selectedTicket.departureCounterId),
        arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
      };

      this.ticketService.updateTicket(updateRequest).subscribe({
        next: () => {
          this.loadTickets();   // rebuilds registry
          this.modalSuccessMessage = '✅ Ticket updated successfully!';
          setTimeout(() => {
            this.modalSuccessMessage = null;
            this.closeModal();
          }, 1500);
        },
        error: (err) => console.error('Failed to update ticket', err),
      });
    } else {
      // ── CREATE ──────────────────────────────────────────────────────────
      const createRequest: CreateTicketDto = {
        id: 0,
        passengerName: this.selectedTicket.passengerName,
        passengerContact: this.selectedTicket.passengerContact,
        seatNumber: this.selectedTicket.seatNumber,
        farePaid: Number(this.selectedTicket.farePaid),
        bookingDateTime: this.selectedTicket.bookingDateTime,
        bookingCounterId: Number(this.selectedTicket.bookingCounterId),
        departureCounterId: Number(this.selectedTicket.departureCounterId),
        arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
      };

      this.ticketService.createTicket(createRequest).subscribe({
        next: () => {
          this.loadTickets();   // rebuilds registry with the newly saved ticket
          this.successMessage = '✅ Ticket saved successfully!';
          setTimeout(() => (this.successMessage = null), 3000);
          this.reset();
        },
        error: (err) => {
          console.error('Failed to save ticket', err);
          this.successMessage = '❌ Failed to save ticket. Check console.';
        },
      });
    }
  }

  reset(): void {
    this.selectedSeats.forEach((s) => (s.status = 'available'));
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.seatBookingBusId = null;
    this.seats = [];
    this.selectedSeats = [];
    this.rows = [];
  }

  openModal(ticket: TicketDto): void {
    this.selectedTicket = { ...ticket };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedTicket = this.emptyTicket();
  }

  confirmDelete(ticket: TicketDto): void {
    this.ticketToDelete = ticket;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmModal = false;
    this.ticketToDelete = null;
  }

  deleteConfirmed(): void {
    if (!this.ticketToDelete) return;

    this.ticketService.deleteTicket(this.ticketToDelete.id).subscribe({
      next: () => {
        this.tickets = this.tickets.filter(
          (t) => t.id !== this.ticketToDelete!.id,
        );
        this.successMessage = '✅ Ticket deleted successfully!';
        setTimeout(() => (this.successMessage = null), 3000);
        this.rebuildBookedSeatRegistry(this.tickets);   // sync registry
        this.updatePagination();
        this.cancelDelete();
      },
      error: (err) => console.error('Failed to delete ticket', err),
    });
  }

  sortBy(field: keyof TicketDto): void {
    this.tickets.sort((a, b) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      return valA > valB ? 1 : valA < valB ? -1 : 0;
    });
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.tickets.length / this.itemsPerPage) || 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    this.goToPage(this.currentPage);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (page - 1) * this.itemsPerPage;
    this.paginatedTickets = this.tickets.slice(start, start + this.itemsPerPage);
  }

  goToPreviousPage(): void { this.goToPage(this.currentPage - 1); }
  goToNextPage(): void     { this.goToPage(this.currentPage + 1); }

  getDepartureTimeForVehicle(vehicleId: number): string {
    const schedule = this.schedules.find(
      (s) => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode),
    );
    return schedule
      ? new Date(schedule.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  getArrivalTimeForVehicle(vehicleId: number): string {
    const schedule = this.schedules.find(
      (s) => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode),
    );
    return schedule
      ? new Date(schedule.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
  }

  getBaseFareForVehicle(vehicleId: number): number | null {
    const schedule = this.schedules.find(
      (s) => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode),
    );
    return schedule ? schedule.baseFare : null;
  }

  /**
   * Returns AVAILABLE seats count (total capacity minus booked on this date).
   * Used in the vehicle card template.
   */
  getSeatsForVehicle(vehicleId: number): number {
    return this.getAvailableSeatsCount(vehicleId);
  }

  getSeatClass(vehicleId: number): string {
    const available = this.getAvailableSeatsCount(vehicleId);
    if (available === 0) return 'full';
    return available < 5 ? 'low' : 'high';
  }

  openDatePicker(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (input && typeof input.showPicker === 'function') {
      input.showPicker();
    }
  }

  // ── Seat Booking ─────────────────────────────────────────────────────────────

  toggleSeatBooking(vehicleId: number): void {
    if (this.seatBookingBusId === vehicleId) {
      // Close the seat panel
      this.seatBookingBusId = null;
      this.seats = [];
      this.selectedSeats = [];
      this.rows = [];
    } else {
      this.seatBookingBusId = vehicleId;
      const vehicle = this.vehicles.find((v) => v.id === vehicleId);
      if (vehicle) {
        this.generateSeats(vehicle.capacity ?? 40, vehicleId);
      }
    }
  }

  /**
   * Generates the full seat grid for a vehicle, then marks every seat that
   * is already booked on the selected departure date as 'reserved'.
   */
  private generateSeats(capacity: number, vehicleId: number): void {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

    for (let r = 0; count < capacity && r < alphabet.length; r++) {
      const row = alphabet[r];
      for (let c = 1; c <= 4 && count < capacity; c++) {
        count++;
        seats.push({
          id: count,
          seatNumber: `${row}${c}`,
          seatCode: `${row}${c}`,
          isBooked: false,
          status: 'available',
        });
      }
    }

    // Fill the last row to a full quad if the capacity is not a multiple of 4
    if (seats.length) {
      const lastRow = seats[seats.length - 1].seatNumber.charAt(0);
      const lastRowSeats = seats.filter((s) => s.seatNumber.charAt(0) === lastRow);
      const existingCols = new Set(
        lastRowSeats.map((s) => parseInt(s.seatNumber.substring(1), 10)),
      );
      for (let c = 1; c <= 4; c++) {
        if (!existingCols.has(c)) {
          count++;
          seats.push({
            id: count,
            seatNumber: `${lastRow}${c}`,
            seatCode: `${lastRow}${c}`,
            isBooked: true,         // placeholder – visually hidden / reserved
            status: 'reserved',
          });
        }
      }
    }

    // ── KEY STEP: mark seats already booked on this date as 'reserved' ──────
    const alreadyBooked = this.getBookedSeatsForVehicleOnDate(
      vehicleId,
      this.selectedDepartureDate,   // bookingDateTime === departureDate
    );

    for (const seat of seats) {
      if (alreadyBooked.includes(seat.seatNumber)) {
        seat.status = 'reserved';
        seat.isBooked = true;
      }
    }

    this.seats = seats;
    this.prepareSeatMap(seats);
  }

  private prepareSeatMap(seats: SeatDto[]): void {
    seats.sort((a, b) => {
      const ra = a.seatNumber.charAt(0);
      const rb = b.seatNumber.charAt(0);
      if (ra !== rb) return ra.charCodeAt(0) - rb.charCodeAt(0);
      return (
        parseInt(a.seatNumber.substring(1), 10) -
        parseInt(b.seatNumber.substring(1), 10)
      );
    });

    this.rows = Array.from(new Set(seats.map((s) => s.seatNumber.charAt(0))));
    this.seatMap = {};
    for (const s of seats) {
      this.seatMap[s.seatNumber] = s;
    }
  }

  getSeatByPosition(row: string, col: number): SeatDto | undefined {
    return this.seatMap?.[`${row}${col}`];
  }

  toggleSeat(seat: SeatDto): void {
    if (!seat || seat.status === 'reserved') return;

    const mapSeat = this.seatMap[seat.seatNumber];
    if (!mapSeat) return;

    if (mapSeat.status === 'selected') {
      mapSeat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(
        (s) => s.seatNumber !== seat.seatNumber,
      );
    } else {
      if (this.selectedSeats.length >= 5) {
        alert('You can only select a maximum of 5 seats.');
        return;
      }
      mapSeat.status = 'selected';
      this.selectedSeats = [...this.selectedSeats, mapSeat];
    }

    this.updateSeatNumberField();
  }

  clearSelection(): void {
    this.selectedSeats.forEach((s) => {
      // Only reset seats that aren't already reserved (booked from DB)
      if (s.status !== 'reserved') s.status = 'available';
    });
    this.selectedSeats = [];
    this.selectedTicket.seatNumber = '';
  }

  confirmBooking(): void {
    if (!this.selectedSeats.length) return;

    this.updateSeatNumberField();

    // Optimistically update the in-memory registry so that if the user opens
    // another vehicle card in the same session these seats stay marked.
    // The definitive write happens in save() → loadTickets() → rebuildRegistry().
    if (this.seatBookingBusId && this.selectedDepartureDate) {
      const key = `${this.seatBookingBusId}|${this.selectedDepartureDate}`;
      if (!this.bookedSeatRegistry[key]) {
        this.bookedSeatRegistry[key] = [];
      }
      for (const s of this.selectedSeats) {
        if (!this.bookedSeatRegistry[key].includes(s.seatNumber)) {
          this.bookedSeatRegistry[key].push(s.seatNumber);
        }
      }
    }

    this.seatBookingBusId = null;   // close the seat panel after confirming
  }

  private updateSeatNumberField(): void {
    this.selectedTicket.seatNumber = this.selectedSeats
      .map((s) => s.seatNumber)
      .sort()
      .join(', ');

    if (this.seatBookingBusId) {
      const schedule = this.schedules.find(
        (s) =>
          s.vehicleId === this.seatBookingBusId &&
          s.routeId === Number(this.selectedRouteCode),
      );
      if (schedule) this.selectedBaseFare = schedule.baseFare;
    }

    this.selectedTicket.farePaid =
      (this.selectedBaseFare || 0) * this.selectedSeats.length;
  }

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  trackRow(_index: number, row: string)  { return row; }
  trackCol(_index: number, col: number)  { return col; }
}