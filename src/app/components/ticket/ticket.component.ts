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

  // ── Cancel modal state ───────────────────────────────────────────────────────
  showCancelConfirmModal = false;
  ticketToCancel: TicketDto | null = null;
  cancelReason: string = 'Counter request';

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

  /**
   * The original ticket being edited — used to exclude its own seats
   * from the "booked" list so the passenger can re-select them.
   */
  private editingOriginalSeats: string[] = [];

  /**
   * Tracks which vehicleId the edit modal originally belonged to.
   * Used to decide whether to pre-select seats when the panel opens.
   */
  private editingOriginalVehicleId: number | null = null;

  /**
   * Tracks whether the edit modal has already pre-selected the original seats.
   * Prevents re-applying pre-selection on subsequent seat panel opens.
   */
  private editSeatsPreSelected = false;

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
                const effectiveBooked = this.showModal
                  ? booked.filter(
                      (s) => !this.editingOriginalSeats.includes(s),
                    )
                  : booked;
                this.availableSeatCounts[vehicle.id] = Math.max(
                  0,
                  capacity - effectiveBooked.length,
                );
              },
              error: () => {
                this.availableSeatCounts[vehicle.id] = vehicle.capacity ?? 0;
              },
            });
          },
          error: () => {
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

  getOperatorNameByTripId(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return '—';
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    if (!schedule) return '—';
    const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
    if (!vehicle) return '—';
    return this.operators.find((o) => o.operatorCode === vehicle.operatorCode)?.name ?? '—';
  }

  getVehicleModelByTripId(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return '';
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    if (!schedule) return '';
    const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
    return vehicle?.model ?? '';
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

    // Close any open seat panel and clear seat selection when date/route changes
    this.closeSeatPanel();

    // Clear seat selection — passenger must re-select seats for new date/route
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.farePaid = 0;
    this.selectedVehicleCode = '';
    this.selectedBaseFare = 0;
    // Reset pre-selection flag since date/route changed
    this.editSeatsPreSelected = false;

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
    if (s) {
      this.selectedBaseFare = s.baseFare;
      if (this.selectedSeats.length > 0) {
        this.selectedTicket.farePaid = s.baseFare * this.selectedSeats.length;
      } else {
        this.selectedTicket.farePaid = s.baseFare;
      }
    }
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
   * Opens the seat panel for a vehicle.
   *
   * Edit mode behaviour (FIX #2):
   * - When the panel opens for the SAME vehicle that the ticket was originally
   *   booked on (and pre-selection hasn't happened yet), the original seats are
   *   pre-selected automatically.
   * - As soon as the user clicks ANY other seat (or opens a different vehicle),
   *   the original seats are released — the editingOriginalSeats list is cleared
   *   so the user starts fresh. This models "exchange seat" flow cleanly.
   */
  openSeatPanel(vehicleCode: string, vehicleId: number): void {
    // Toggle off if already open for this vehicle
    if (this.seatBookingBusId === vehicleId) {
      this.closeSeatPanel();
      return;
    }

    if (!this.selectedRouteCode) {
      this.showError('Please select a route before booking seats.');
      return;
    }
    if (!this.selectedDepartureDate) {
      this.showError('Please select a departure date before booking seats.');
      return;
    }

    // If switching to a DIFFERENT vehicle while editing, clear original seat
    // selection so the user starts with a blank slate on the new vehicle.
    if (this.showModal && this.editingOriginalVehicleId !== null && this.editingOriginalVehicleId !== vehicleId) {
      this.editingOriginalSeats = [];
      this.editSeatsPreSelected = false;
      this.selectedTicket.seatNumber = '';
      this.selectedTicket.farePaid = 0;
    }

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

    // ── Step 1: Show seat grid immediately ────────────────────────────────────
    this.liveBookedSeats = [];
    this.activeTripId = null;
    this.selectedSeats = [];
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;

    this.generateSeats(capacity);

    // ── Step 2: Fetch live booked seats asynchronously ────────────────────────
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

              // Exclude original ticket seats from booked list
              // so they appear as "available" and can be re-selected
              this.liveBookedSeats = bookedSeats.filter(
                (s) => !this.editingOriginalSeats.includes(s),
              );

              // Update badge with accurate count
              this.availableSeatCounts[vehicleId] = Math.max(
                0,
                capacity - this.liveBookedSeats.length,
              );

              if (this.seatBookingBusId === vehicleId) {
                this.generateSeats(capacity);

                // ── FIX #2: Pre-select original seats when editing ────────────
                // Only if: edit mode, haven't pre-selected yet, same vehicle,
                // and there are original seats to restore.
                const isSameVehicle = this.editingOriginalVehicleId === vehicleId;
                if (
                  this.showModal &&
                  !this.editSeatsPreSelected &&
                  isSameVehicle &&
                  this.editingOriginalSeats.length > 0
                ) {
                  this.editSeatsPreSelected = true;
                  for (const seatNum of this.editingOriginalSeats) {
                    const seat = this.seatMap[seatNum];
                    if (seat && seat.status === 'available') {
                      seat.status = 'selected';
                      this.selectedSeats.push(seat);
                    }
                  }
                  this.updateSeatNumberField();
                }
              }
            },
            error: (e) => {
              console.error('Failed to load booked seats', e);
              this.seatPanelLoading = false;
            },
          });
        },
        error: (e) => {
          console.error('Failed to resolve trip', e);
          this.seatPanelLoading = false;
        },
      });
  }

  /** Legacy shim */
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
   * Builds the full seat grid from capacity, marking seats in liveBookedSeats
   * as 'reserved'. Layout: 4 seats per row (cols 1–4), lettered rows A, B, C…
   */
  private generateSeats(capacity: number): void {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

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
          status: this.liveBookedSeats.includes(seatNum)
            ? 'reserved'
            : 'available',
        });
      }
    }

    // Pad last row to a full block of 4 for even grid rendering
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
            status: 'reserved',
          });
        }
      }
    }

    this.seats = seats;
    this.buildSeatMap(seats);
  }

  private buildSeatMap(seats: SeatDto[]): void {
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

  /**
   * FIX #2 — toggleSeat:
   * The moment the user manually clicks ANY seat while editing, release the
   * original pre-selected seats lock so they behave like normal toggles.
   * editingOriginalSeats is cleared so switching vehicle won't re-apply them.
   */
  toggleSeat(seat: SeatDto): void {
    if (!seat || seat.status === 'reserved') return;

    const mapSeat = this.seatMap[seat.seatNumber];
    if (!mapSeat) return;

    // Once the user manually interacts, release the "original seats" lock.
    // This means: if they click another seat (or even re-click an original seat),
    // the editingOriginalSeats no longer protect those seats as "pre-selected".
    if (this.showModal && this.editSeatsPreSelected && this.editingOriginalSeats.length > 0) {
      // Clear the original seats lock — user is now freely choosing
      this.editingOriginalSeats = [];
    }

    if (mapSeat.status === 'selected') {
      mapSeat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(
        (s) => s.seatNumber !== seat.seatNumber,
      );
    } else {
      if (this.selectedSeats.length >= 5) {
        this.showToast('error', '⚠️ Maximum 5 seats can be booked per ticket.', 5000);
        // alert('You can only select a maximum of 5 seats.');
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
    this.selectedTicket.farePaid = 0;
    // Clear original seats lock when user explicitly clears
    if (this.showModal) {
      this.editingOriginalSeats = [];
    }
  }

  private updateSeatNumberField(): void {
    this.selectedTicket.seatNumber = this.selectedSeats
      .map((s) => s.seatNumber)
      .sort()
      .join(', ');

    if (this.seatBookingBusId) {
      const s = this.schedules.find(
        (sch) =>
          sch.vehicleId === this.seatBookingBusId &&
          sch.routeId === Number(this.selectedRouteCode),
      );
      if (s) {
        this.selectedBaseFare = s.baseFare;
      }
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
    // ── Validation ──────────────────────────────────────────────
    const setError = (msg: string) => {
      const target = this.showModal ? 'modalSuccessMessage' : 'successMessage';
      (this as any)[target] = `❌ ${msg}`;
      setTimeout(() => ((this as any)[target] = null), 3000);
    };

    if (!this.selectedTicket.passengerName?.trim()) {
      return setError('Please provide Passenger Name.');
    }
    if (!this.selectedTicket.passengerContact?.trim()) {
      return setError('Please provide Passenger Contact.');
    }
    if (!this.selectedTicket.seatNumber?.trim()) {
      return setError('Please select at least one seat.');
    }
    if (!this.selectedSeats.length && !this.selectedTicket.seatNumber?.trim()) {
      return setError('Please select at least one seat from the vehicle seat map.');
    }
    if (!this.selectedTicket.bookingCounterId) {
      return setError('Please select Booking Counter.');
    }
    if (!this.selectedTicket.departureCounterId) {
      return setError('Please select Departure Counter.');
    }
    if (!this.selectedTicket.arrivalCounterId) {
      return setError('Please select Arrival Counter.');
    }

    const vehicleId = this.vehicles.find(
      (v) => v.vehicleCode === this.selectedVehicleCode,
    )?.id;
    const schedule = this.schedules.find(
      (s) =>
        s.routeId === Number(this.selectedRouteCode) &&
        s.vehicleId === vehicleId,
    );

    if (!schedule) {
      return setError('Please select a valid vehicle/route combination.');
    }

    if (this.selectedTicket.id) {
      // ── UPDATE ───────────────────────────────────────────────────────────────
      this.tripService
        .findOrCreate({
          scheduleId: schedule.id,
          tripDate: this.selectedDepartureDate,
        })
        .subscribe({
          next: (trip) => {
            const dto: UpdateTicketDto = {
              id: this.selectedTicket.id,
              tripId: trip.id,
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
                this.loadTrips();
                this.editingOriginalSeats = [];
                this.editSeatsPreSelected = false;
                this.editingOriginalVehicleId = null;
                this.modalSuccessMessage = '✅ Ticket updated successfully!';
                setTimeout(() => {
                  this.modalSuccessMessage = null;
                  this.closeModal();
                }, 1500);
              },
              error: (e) => {
                console.error('Update failed', e);
                this.modalSuccessMessage = '❌ Failed to update ticket.';
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed during update', e);
            this.modalSuccessMessage = '❌ Could not resolve trip. Check schedule/date.';
          },
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
              departureCounterId: Number(this.selectedTicket.departureCounterId),
              arrivalCounterId: Number(this.selectedTicket.arrivalCounterId),
            };

            this.ticketService.createTicket(dto).subscribe({
              next: () => {
                this.loadTickets();
                this.loadTrips();
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
            this.successMessage = '❌ Could not resolve trip. Check schedule/date.';
          },
        });
    }
  }

  // ── Cancel ticket ─────────────────────────────────────────────────────────────

  confirmCancel(ticket: TicketDto): void {
    this.ticketToCancel = ticket;
    this.cancelReason = 'Counter request';
    this.showCancelConfirmModal = true;
  }

  cancelCancelAction(): void {
    this.showCancelConfirmModal = false;
    this.ticketToCancel = null;
  }

  cancelConfirmed(): void {
    if (!this.ticketToCancel) return;
    const dto: CancelTicketDto = {
      id: this.ticketToCancel.id,
      reason: this.cancelReason,
    };
    this.ticketService.cancelTicket(dto).subscribe({
      next: () => {
        this.loadTickets();
        this.loadTrips();
        this.successMessage = '✅ Ticket cancelled successfully.';
        setTimeout(() => (this.successMessage = null), 3000);
        this.cancelCancelAction();
      },
      error: (e) => {
        console.error('Cancel failed', e);
        this.successMessage = '❌ Failed to cancel ticket.';
        this.cancelCancelAction();
      },
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
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.closeSeatPanel();
  }

  openModal(ticket: TicketDto): void {
    this.selectedTicket = { ...ticket };

    // Store original seats so they can be excluded from "booked" list
    this.editingOriginalSeats = ticket.seatNumber
      ? ticket.seatNumber.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Reset pre-selection flag — will be set to true once seats are loaded
    this.editSeatsPreSelected = false;

    // Resolve trip → schedule → route to pre-populate dropdowns
    const trip = this.trips.find((t) => t.id === ticket.tripId);
    if (trip) {
      const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
      if (schedule) {
        this.selectedRouteCode = String(schedule.routeId);

        const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
        if (vehicle) {
          this.selectedVehicleCode = vehicle.vehicleCode;
          // Track which vehicle this ticket originally belonged to
          this.editingOriginalVehicleId = vehicle.id;
        }

        const tripDate = new Date(trip.tripDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        this.selectedDepartureDate = `${tripDate.getFullYear()}-${pad(tripDate.getMonth() + 1)}-${pad(tripDate.getDate())}`;

        // Populate vehicle list and arrival date without clearing seats
        this._populateVehiclesAndArrivalDate();

        this.selectedBaseFare = schedule.baseFare;
      }
    }

    if (ticket.bookingDateTime) {
      this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(0, 10);
    }

    this.showModal = true;
  }

  /**
   * Internal helper: populates availableVehicles and selectedArrivalDate
   * from the current selectedRouteCode + selectedDepartureDate WITHOUT
   * clearing the seat selection. Used when first opening the edit modal.
   */
  private _populateVehiclesAndArrivalDate(): void {
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

    this.availableVehicles = this.vehicles.filter((v) =>
      this.schedules.some(
        (s) =>
          s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id,
      ),
    );

    this.refreshAvailableSeatCounts();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.closeSeatPanel();
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
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
    this.paginatedTickets = this.tickets.slice(start, start + this.itemsPerPage);
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


// ─────────────────────────────────────────────────────────────
//  TOAST SYSTEM — add to your component .ts
//  Replace every `this.successMessage = '...'` call with
//  `this.showToast('success' | 'error' | 'warn' | 'info', '...')`
// ─────────────────────────────────────────────────────────────

// 1. Add to your component class properties:

toasts: { id: number; type: 'success' | 'error' | 'warn' | 'info'; message: string }[] = [];
private _toastId = 0;

// 2. Add these methods to your component class:

showToast(type: 'success' | 'error' | 'warn' | 'info', message: string, durationMs = 4000): void {
  const id = ++this._toastId;
  this.toasts.push({ id, type, message });
  setTimeout(() => this.dismissToast(id), durationMs);
}

dismissToast(id: number): void {
  this.toasts = this.toasts.filter(t => t.id !== id);
}

trackToast(_: number, toast: { id: number }): number {
  return toast.id;
}

// 3. In toggleSeat() — replace the 5-seat limit alert:
//    BEFORE:  alert('Max 5 seats allowed');
//    AFTER:
// toggleSeat(seat: any): void {
//   if (seat.status === 'reserved') return;

//   if (seat.status === 'selected') {
//     seat.status = 'available';
//     this.selectedSeats = this.selectedSeats.filter(s => s.seatNumber !== seat.seatNumber);
//   } else {
//     if (this.selectedSeats.length >= 5) {
//       this.showToast('error', '⚠️ Maximum 5 seats can be booked per ticket.', 5000);
//       return;
//     }
//     seat.status = 'selected';
//     this.selectedSeats.push(seat);
//   }
//   // update ticket fields...
// }

// 4. Replace save() success/error messages:
//    BEFORE:  this.successMessage = '✅ Ticket saved!';
//    AFTER:   this.showToast('success', 'Ticket saved successfully!');

//    BEFORE:  this.successMessage = '❌ Please fill all fields.';
//    AFTER:   this.showToast('error', 'Please fill all required fields.');

// 5. Remove these from your template (no longer needed):
//    <div *ngIf="successMessage" class="alert" ...>
//    <div *ngIf="modalSuccessMessage" class="alert modal-alert" ...>


}