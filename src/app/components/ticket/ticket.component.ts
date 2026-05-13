// ticket.component.ts
import { Component, OnInit } from '@angular/core';
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
  CancelTicketDto,
  TripDto,
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketService } from '../../services/ticket.service';
import { TripService } from '../../services/trip.service';

@Component({
  selector: 'app-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket.component.html',
  styleUrls: ['./ticket.component.css'],
})
export class TicketComponent implements OnInit {
  // ── Data lists ───────────────────────────────────────────────────────────────
  tickets: TicketDto[] = [];
  paginatedTickets: TicketDto[] = [];
  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  counters: TicketCounterDto[] = [];
  availableVehicles: Vehicle[] = [];
  trips: TripDto[] = [];

  // ── Selected / form state ────────────────────────────────────────────────────
  selectedTicket: TicketDto = this.emptyTicket();
  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

  // ── UI state ─────────────────────────────────────────────────────────────────
  successMessage: string | null = null;
  modalSuccessMessage: string | null = null;
  showModal = false;
  showDeleteConfirmModal = false;
  ticketToDelete: TicketDto | null = null;

  /** True while the seat panel is loading from the backend */
  seatPanelLoading = false;

  // ── Pagination ───────────────────────────────────────────────────────────────
  currentPage = 1;
  itemsPerPage = 25;
  totalPages = 1;
  pages: number[] = [];

  // ── Seat booking state ───────────────────────────────────────────────────────
  seatBookingBusId: number | null = null;
  seats: SeatDto[] = [];
  seatMap: Record<string, SeatDto> = {};
  selectedSeats: SeatDto[] = [];
  rows: string[] = [];

  /** Live seat numbers already booked for the open trip. Fetched from backend. */
  liveBookedSeats: string[] = [];

  /** tripId resolved for the currently open seat panel. */
  private activeTripId: number | null = null;

  /** Available-seat counts per vehicleId, refreshed after date selection. */
  private availableSeatCounts: Record<number, number> = {};

  constructor(
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ticketCounterService: TicketCounterService,
    private ticketService: TicketService,
    private tripService: TripService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    this.loadRoutes();
    this.loadVehicles();
    this.loadOperators();
    this.loadSchedules();
    this.loadCounters();
    this.loadTickets();
    this.loadTrips();
  }

  // ── Data loaders ─────────────────────────────────────────────────────────────

  loadRoutes(): void {
    this.routeService.getAllRoutes().subscribe({
      next: (d) => (this.routes = d),
      error: (e) => console.error('Failed to load routes', e),
    });
  }

  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: (d) => (this.vehicles = d),
      error: (e) => console.error('Failed to load vehicles', e),
    });
  }

  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: (d) => (this.operators = d),
      error: (e) => console.error('Failed to load operators', e),
    });
  }

  loadSchedules(): void {
    this.scheduleService.getAllSchedules().subscribe({
      next: (d) => (this.schedules = d),
      error: (e) => console.error('Failed to load schedules', e),
    });
  }

  loadCounters(): void {
    this.ticketCounterService.getAllTicketCounters().subscribe({
      next: (d) => (this.counters = d),
      error: (e) => console.error('Failed to load counters', e),
    });
  }

  loadTickets(): void {
    this.ticketService.getTickets().subscribe({
      next: (d) => {
        this.tickets = d;
        this.updatePagination();
      },
      error: (e) => console.error('Failed to load tickets', e),
    });
  }

  loadTrips(): void {
    this.tripService.getAll().subscribe({
      next: (d) => (this.trips = d),
      error: (e) => console.error('Failed to load trips', e),
    });
  }

  // ── Available-seat count helpers ─────────────────────────────────────────────

  /**
   * For every vehicle on this route+date, resolve its Trip then fetch
   * booked seats so the badge on each vehicle card is accurate.
   */
  private refreshAvailableSeatCounts(): void {
    this.availableSeatCounts = {};

    for (const vehicle of this.availableVehicles) {
      const schedule = this.schedules.find(
        (s) =>
          s.vehicleId === vehicle.id &&
          s.routeId === Number(this.selectedRouteCode),
      );
      if (!schedule) continue;

      this.tripService
        .findOrCreate({
          scheduleId: schedule.id,
          tripDate: this.selectedDepartureDate,
        })
        .subscribe({
          next: (trip) => {
            this.tripService.getBookedSeats(trip.id).subscribe({
              next: (booked) => {
                const capacity = vehicle.capacity ?? 0;
                this.availableSeatCounts[vehicle.id] = Math.max(
                  0,
                  capacity - booked.length,
                );
              },
              error: () => {
                // Fallback: show full capacity if we can't fetch booked seats
                this.availableSeatCounts[vehicle.id] = vehicle.capacity ?? 0;
              },
            });
          },
          error: () => {
            // Fallback: show full capacity if trip resolution fails
            this.availableSeatCounts[vehicle.id] = vehicle.capacity ?? 0;
          },
        });
    }
  }

  // ── Template helpers ─────────────────────────────────────────────────────────

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    return (
      this.operators.find((o) => o.operatorCode === operatorCode)?.name ?? ''
    );
  }

  getCounterName(id: number | string | undefined): string {
    if (id === undefined || id === null) return '—';
    return this.counters.find((c) => c.id === Number(id))?.counterName ?? '—';
  }

  getRouteNameByTripId(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return '—';
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    if (!schedule) return '—';
    const route = this.routes.find((r) => r.id === schedule.routeId);
    return route?.routeName ?? '—';
  }

  calculateArrivalDate(): void {
    if (!this.selectedDepartureDate || !this.selectedRouteCode) return;

    const route = this.routes.find(
      (r) => r.id === Number(this.selectedRouteCode),
    );
    if (!route?.estimatedDurationHours) return;

    const dep = new Date(this.selectedDepartureDate);
    const arr = new Date(
      dep.getTime() + route.estimatedDurationHours * 3_600_000,
    );
    const pad = (n: number) => n.toString().padStart(2, '0');

    this.selectedArrivalDate = `${arr.getFullYear()}-${pad(arr.getMonth() + 1)}-${pad(arr.getDate())}`;

    this.selectedTicket.bookingDateTime = this.selectedDepartureDate;

    this.availableVehicles = this.vehicles.filter((v) =>
      this.schedules.some(
        (s) =>
          s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id,
      ),
    );

    this.closeSeatPanel();
    this.refreshAvailableSeatCounts();
  }

  fillBaseFare(): void {
    const vid = this.vehicles.find(
      (v) => v.vehicleCode === this.selectedVehicleCode,
    )?.id;
    const s = this.schedules.find(
      (s) =>
        s.routeId === Number(this.selectedRouteCode) && s.vehicleId === vid,
    );
    if (s) this.selectedBaseFare = s.baseFare;
  }

  getDepartureTimeForVehicle(vehicleId: number): string {
    const s = this.schedules.find(
      (s) =>
        s.vehicleId === vehicleId &&
        s.routeId === Number(this.selectedRouteCode),
    );
    return s
      ? new Date(s.departureDateTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
  }

  getArrivalTimeForVehicle(vehicleId: number): string {
    const s = this.schedules.find(
      (s) =>
        s.vehicleId === vehicleId &&
        s.routeId === Number(this.selectedRouteCode),
    );
    return s
      ? new Date(s.arrivalDateTime).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—';
  }

  getBaseFareForVehicle(vehicleId: number): number | null {
    return (
      this.schedules.find(
        (s) =>
          s.vehicleId === vehicleId &&
          s.routeId === Number(this.selectedRouteCode),
      )?.baseFare ?? null
    );
  }

  /**
   * Returns available seat count for a vehicle badge.
   * Falls back to full capacity while the async fetch is in flight.
   */
  getSeatsForVehicle(vehicleId: number): number {
    if (vehicleId in this.availableSeatCounts) {
      return this.availableSeatCounts[vehicleId];
    }
    return this.vehicles.find((v) => v.id === vehicleId)?.capacity ?? 0;
  }

  getSeatClass(vehicleId: number): string {
    const n = this.getSeatsForVehicle(vehicleId);
    if (n === 0) return 'full';
    if (n < 5) return 'low';
    return 'high';
  }

  openDatePicker(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (typeof input?.showPicker === 'function') input.showPicker();
  }

  // ── Seat booking ─────────────────────────────────────────────────────────────

  /**
   * Called from the template "Book Seats" button.
   * vehicleCode and vehicleId are passed in explicitly so we don't
   * rely on selectedVehicleCode being set before this method runs
   * (Angular evaluates compound click expressions left-to-right but
   * component property assignment happens synchronously, so it's fine —
   * however passing explicitly is safer and avoids confusion).
   *
   * KEY FIX: We now call generateSeats() immediately with whatever
   * capacity we know from local data, showing the grid right away.
   * We then overlay live booked-seat data from the backend asynchronously.
   * This means the seat grid is ALWAYS visible, even if the network call
   * is slow or fails.
   */
  openSeatPanel(vehicleCode: string, vehicleId: number): void {
    // If already open for this vehicle, close it
    if (this.seatBookingBusId === vehicleId) {
      this.closeSeatPanel();
      return;
    }

    // Guard — route and departure date must be selected
    if (!this.selectedRouteCode) {
      this.showError('Please select a route before booking seats.');
      return;
    }
    if (!this.selectedDepartureDate) {
      this.showError('Please select a departure date before booking seats.');
      return;
    }

    // Set selected vehicle code so fillBaseFare works correctly
    this.selectedVehicleCode = vehicleCode;
    this.fillBaseFare();

    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    const schedule = this.schedules.find(
      (s) =>
        s.vehicleId === vehicleId &&
        s.routeId === Number(this.selectedRouteCode),
    );

    if (!vehicle || !schedule) {
      this.showError('Could not find vehicle or schedule information.');
      return;
    }

    const capacity = vehicle.capacity ?? 40;

    // ── Step 1: Show the seat grid immediately with local data ────────────────
    // Reset panel state
    this.liveBookedSeats = [];
    this.activeTripId = null;
    this.selectedSeats = [];
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;

    // Generate seats right away so the grid appears instantly
    this.generateSeats(capacity);

    // ── Step 2: Fetch live booked seats from backend asynchronously ───────────
    this.tripService
      .findOrCreate({
        scheduleId: schedule.id,
        tripDate: this.selectedDepartureDate,
      })
      .subscribe({
        next: (trip) => {
          this.activeTripId = trip.id;

          this.tripService.getBookedSeats(trip.id).subscribe({
            next: (bookedSeats) => {
              this.seatPanelLoading = false;
              this.liveBookedSeats = bookedSeats;

              // Update badge count with accurate live data
              this.availableSeatCounts[vehicleId] = Math.max(
                0,
                capacity - bookedSeats.length,
              );

              // Re-generate seats now that we have live booked data
              // (only if panel is still open for this vehicle)
              if (this.seatBookingBusId === vehicleId) {
                this.generateSeats(capacity);
              }
            },
            error: (e) => {
              console.error(
                'Failed to load booked seats — showing all as available',
                e,
              );
              this.seatPanelLoading = false;
              // Grid already shown from Step 1; just stop the spinner
            },
          });
        },
        error: (e) => {
          console.error(
            'Failed to resolve trip — showing all seats as available',
            e,
          );
          this.seatPanelLoading = false;
          // Grid already shown from Step 1; seats will all appear available
          // which is safe — the server will reject double-bookings anyway
        },
      });
  }

  /** Legacy method kept for any code that still calls it; delegates to openSeatPanel */
  toggleSeatBooking(vehicleId: number): void {
    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    if (vehicle) {
      this.openSeatPanel(vehicle.vehicleCode, vehicleId);
    }
  }

  private closeSeatPanel(): void {
    this.seatBookingBusId = null;
    this.activeTripId = null;
    this.liveBookedSeats = [];
    this.seats = [];
    this.selectedSeats = [];
    this.rows = [];
    this.seatMap = {};
    this.seatPanelLoading = false;
  }

  private showError(msg: string): void {
    this.successMessage = `❌ ${msg}`;
    setTimeout(() => (this.successMessage = null), 3000);
  }

  /**
   * Builds the full seat grid from capacity, then marks seats that
   * appear in liveBookedSeats as 'reserved'.
   *
   * Layout: 4 seats per row (cols 1-4), lettered rows A, B, C…
   * The seat grid is a 2+aisle+2 layout rendered in the template.
   */
  private generateSeats(capacity: number): void {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

    // Build exactly `capacity` real seats
    outer: for (let r = 0; r < alphabet.length; r++) {
      const row = alphabet[r];
      for (let c = 1; c <= 4; c++) {
        if (count >= capacity) break outer;
        count++;
        const seatNum = `${row}${c}`;
        seats.push({
          id: count,
          seatNumber: seatNum,
          seatCode: seatNum,
          isBooked: false,
          // Mark reserved immediately if in liveBookedSeats
          status: this.liveBookedSeats.includes(seatNum)
            ? 'reserved'
            : 'available',
        });
      }
    }

    // Pad the last row to a full block of 4 so the grid renders evenly
    if (seats.length > 0) {
      const lastRow = seats[seats.length - 1].seatNumber.charAt(0);
      const existingCols = new Set(
        seats
          .filter((s) => s.seatNumber.charAt(0) === lastRow)
          .map((s) => parseInt(s.seatNumber.substring(1), 10)),
      );
      let padId = count;
      for (let c = 1; c <= 4; c++) {
        if (!existingCols.has(c)) {
          padId++;
          const seatNum = `${lastRow}${c}`;
          seats.push({
            id: padId,
            seatNumber: seatNum,
            seatCode: seatNum,
            isBooked: true,
            status: 'reserved', // ghost/padding — not a real seat
          });
        }
      }
    }

    this.seats = seats;
    this.buildSeatMap(seats);
  }

  private buildSeatMap(seats: SeatDto[]): void {
    // Sort: row letter first, then column number
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
    return this.seatMap[`${row}${col}`];
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
      if (s.status !== 'reserved') s.status = 'available';
    });
    this.selectedSeats = [];
    this.selectedTicket.seatNumber = '';
  }

  confirmBooking(): void {
    if (!this.selectedSeats.length) return;

    this.updateSeatNumberField();

    // Optimistically update liveBookedSeats so badge refreshes immediately
    for (const s of this.selectedSeats) {
      if (!this.liveBookedSeats.includes(s.seatNumber)) {
        this.liveBookedSeats.push(s.seatNumber);
      }
    }

    // Update badge count
    if (this.seatBookingBusId !== null) {
      const capacity =
        this.vehicles.find((v) => v.id === this.seatBookingBusId)?.capacity ??
        0;
      this.availableSeatCounts[this.seatBookingBusId] = Math.max(
        0,
        capacity - this.liveBookedSeats.length,
      );
    }

    this.closeSeatPanel();
  }

  private updateSeatNumberField(): void {
    this.selectedTicket.seatNumber = this.selectedSeats
      .map((s) => s.seatNumber)
      .sort()
      .join(', ');

    if (this.seatBookingBusId) {
      const s = this.schedules.find(
        (s) =>
          s.vehicleId === this.seatBookingBusId &&
          s.routeId === Number(this.selectedRouteCode),
      );
      if (s) this.selectedBaseFare = s.baseFare;
    }

    this.selectedTicket.farePaid =
      (this.selectedBaseFare || 0) * this.selectedSeats.length;
  }

  // ── Save / Update ─────────────────────────────────────────────────────────────

  emptyTicket(): TicketDto {
    return {
      id: 0,
      tripId: 0,
      ticketCode: '',
      passengerName: '',
      passengerContact: '',
      seatNumber: '',
      farePaid: 0,
      bookingDateTime: this.getTodayDateString(),
      bookingCounterId: 0,
      departureCounterId: 0,
      arrivalCounterId: 0,
      status: 'Booked',
      createdAt: '',
      createdBy: '',
    };
  }

  save(): void {
    const vehicleId = this.vehicles.find(
      (v) => v.vehicleCode === this.selectedVehicleCode,
    )?.id;
    const schedule = this.schedules.find(
      (s) =>
        s.routeId === Number(this.selectedRouteCode) &&
        s.vehicleId === vehicleId,
    );

    if (!schedule) {
      this.successMessage =
        '❌ Please select a valid vehicle/route combination.';
      return;
    }

    if (this.selectedTicket.id) {
      // ── UPDATE ──────────────────────────────────────────────────────────────
      const dto: UpdateTicketDto = {
        id: this.selectedTicket.id,
        tripId: this.selectedTicket.tripId,
        passengerName: this.selectedTicket.passengerName,
        passengerContact: this.selectedTicket.passengerContact,
        seatNumber: this.selectedTicket.seatNumber,
        farePaid: Number(this.selectedTicket.farePaid),
        bookingDateTime: this.selectedTicket.bookingDateTime,
        bookingCounterId: Number(this.selectedTicket.bookingCounterId),
        departureCounterId: Number(this.selectedTicket.departureCounterId),
        arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
      };

      this.ticketService.updateTicket(dto).subscribe({
        next: () => {
          this.loadTickets();
          this.modalSuccessMessage = '✅ Ticket updated successfully!';
          setTimeout(() => {
            this.modalSuccessMessage = null;
            this.closeModal();
          }, 1500);
        },
        error: (e) => console.error('Update failed', e),
      });
    } else {
      // ── CREATE ───────────────────────────────────────────────────────────────
      this.tripService
        .findOrCreate({
          scheduleId: schedule.id,
          tripDate: this.selectedDepartureDate,
        })
        .subscribe({
          next: (trip) => {
            const dto: CreateTicketDto = {
              tripId: trip.id,
              passengerName: this.selectedTicket.passengerName,
              passengerContact: this.selectedTicket.passengerContact,
              seatNumber: this.selectedTicket.seatNumber,
              farePaid: Number(this.selectedTicket.farePaid),
              bookingDateTime: this.selectedTicket.bookingDateTime,
              bookingCounterId: Number(this.selectedTicket.bookingCounterId),
              departureCounterId: Number(
                this.selectedTicket.departureCounterId,
              ),
              arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
            };

            this.ticketService.createTicket(dto).subscribe({
              next: () => {
                this.loadTickets();
                this.loadTrips(); // ← ADD THIS
                this.successMessage = '✅ Ticket saved successfully!';
                setTimeout(() => (this.successMessage = null), 3000);
                this.reset();
              },
              error: (e) => {
                console.error('Create ticket failed', e);
                this.successMessage = '❌ Failed to save ticket.';
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed', e);
            this.successMessage =
              '❌ Could not resolve trip. Check schedule/date.';
          },
        });
    }
  }

  cancelTicket(ticket: TicketDto): void {
    const dto: CancelTicketDto = { id: ticket.id, reason: 'Counter request' };
    this.ticketService.cancelTicket(dto).subscribe({
      next: () => {
        this.loadTickets();
        this.successMessage = '✅ Ticket cancelled.';
        setTimeout(() => (this.successMessage = null), 3000);
      },
      error: (e) => console.error('Cancel failed', e),
    });
  }

  // ── CRUD helpers ──────────────────────────────────────────────────────────────

  reset(): void {
    this.selectedSeats.forEach((s) => {
      if (s.status !== 'reserved') s.status = 'available';
    });
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.closeSeatPanel();
  }

  openModal(ticket: TicketDto): void {
    this.selectedTicket = { ...ticket };

    // Resolve trip → schedule → route to pre-populate dropdowns
    const trip = this.trips.find((t) => t.id === ticket.tripId);
    if (trip) {
      const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
      if (schedule) {
        // Pre-populate route
        this.selectedRouteCode = String(schedule.routeId);

        // Pre-populate vehicle
        const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
        if (vehicle) {
          this.selectedVehicleCode = vehicle.vehicleCode;
        }

        // Pre-populate departure date (extract date part from schedule)
        // Use tripDate from the trip as the departure date
        const tripDate = new Date(trip.tripDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        this.selectedDepartureDate = `${tripDate.getFullYear()}-${pad(tripDate.getMonth() + 1)}-${pad(tripDate.getDate())}`;

        // Calculate arrival date and load available vehicles
        this.calculateArrivalDate();

        // Pre-populate base fare
        this.selectedBaseFare = schedule.baseFare;
      }
    }

    // Pre-populate booking date (bookingDateTime may be full ISO or date-only)
    if (ticket.bookingDateTime) {
      this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(
        0,
        10,
      );
    }

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
        this.loadTrips(); // ← ADD THIS
        this.updatePagination();
        this.cancelDelete();
      },
      error: (e) => console.error('Failed to delete ticket', e),
    });
  }

  // ── Sorting / pagination ──────────────────────────────────────────────────────

  sortBy(field: keyof TicketDto): void {
    this.tickets.sort((a, b) => {
      const va = a[field] ?? '';
      const vb = b[field] ?? '';
      return va > vb ? 1 : va < vb ? -1 : 0;
    });
    this.updatePagination();
  }

  updatePagination(): void {
    this.totalPages = Math.ceil(this.tickets.length / this.itemsPerPage) || 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.goToPage(this.currentPage);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (page - 1) * this.itemsPerPage;
    this.paginatedTickets = this.tickets.slice(
      start,
      start + this.itemsPerPage,
    );
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  // ── Utilities ─────────────────────────────────────────────────────────────────

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
