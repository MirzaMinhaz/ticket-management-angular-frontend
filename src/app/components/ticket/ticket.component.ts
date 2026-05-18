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
  mlw: 'assets/img/br.jpeg',
  caetano: 'assets/img/caetano.jpeg',
};

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
  sortField: string = '';
  sortAsc: boolean = true;

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

  private editingOriginalSeats: string[] = [];
  private editingOriginalVehicleId: number | null = null;
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
                  ? booked.filter((s) => !this.editingOriginalSeats.includes(s))
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
    return (
      this.operators.find((o) => o.operatorCode === vehicle.operatorCode)
        ?.name ?? '—'
    );
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

    this.closeSeatPanel();

    this.selectedTicket.seatNumber = '';
    this.selectedTicket.farePaid = 0;
    this.selectedVehicleCode = '';
    this.selectedBaseFare = 0;
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

  // ── Brand Logo Helpers ─────────────────────────────────────────────────────

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

  // ── Seat booking ─────────────────────────────────────────────────────────────

  openSeatPanel(vehicleCode: string, vehicleId: number): void {
    if (this.seatBookingBusId === vehicleId) {
      this.closeSeatPanel();
      return;
    }

    if (!this.selectedRouteCode) {
      this.showToast('error', 'Please select a route before booking seats.');
      return;
    }
    if (!this.selectedDepartureDate) {
      this.showToast('error', 'Please select a departure date before booking seats.');
      return;
    }

    if (
      this.showModal &&
      this.editingOriginalVehicleId !== null &&
      this.editingOriginalVehicleId !== vehicleId
    ) {
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
      this.showToast('error', 'Could not find vehicle or schedule information.');
      return;
    }

    const capacity = vehicle.capacity ?? 40;

    this.liveBookedSeats = [];
    this.activeTripId = null;
    this.selectedSeats = [];
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;

    this.generateSeats(capacity);

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

              this.liveBookedSeats = bookedSeats.filter(
                (s) => !this.editingOriginalSeats.includes(s),
              );

              this.availableSeatCounts[vehicleId] = Math.max(
                0,
                capacity - this.liveBookedSeats.length,
              );

              if (this.seatBookingBusId === vehicleId) {
                this.generateSeats(capacity);

                const isSameVehicle =
                  this.editingOriginalVehicleId === vehicleId;
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

  toggleSeat(seat: SeatDto): void {
    if (!seat || seat.status === 'reserved') return;

    const mapSeat = this.seatMap[seat.seatNumber];
    if (!mapSeat) return;

    if (
      this.showModal &&
      this.editSeatsPreSelected &&
      this.editingOriginalSeats.length > 0
    ) {
      this.editingOriginalSeats = [];
    }

    if (mapSeat.status === 'selected') {
      mapSeat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(
        (s) => s.seatNumber !== seat.seatNumber,
      );
    } else {
      if (this.selectedSeats.length >= 5) {
        this.showToast('warn', 'Maximum 5 seats can be booked per ticket.');
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
    const fail = (msg: string) => { this.showToast('error', msg); };

    if (!this.selectedTicket.passengerName?.trim()) {
      return fail('Please provide Passenger Name.');
    }
    if (!this.selectedTicket.passengerContact?.trim()) {
      return fail('Please provide Passenger Contact.');
    }
    if (!this.selectedTicket.seatNumber?.trim()) {
      return fail('Please select at least one seat.');
    }
    if (!this.selectedTicket.bookingCounterId) {
      return fail('Please select Booking Counter.');
    }
    if (!this.selectedTicket.departureCounterId) {
      return fail('Please select Departure Counter.');
    }
    if (!this.selectedTicket.arrivalCounterId) {
      return fail('Please select Arrival Counter.');
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
      return fail('Please select a valid vehicle/route combination.');
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
                this.showToast('success', 'Ticket updated successfully!');
                setTimeout(() => this.closeModal(), 1500);
              },
              error: (e) => {
                console.error('Update failed', e);
                this.showToast('error', 'Failed to update ticket. Please try again.');
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed during update', e);
            this.showToast('error', 'Could not resolve trip. Check schedule/date.');
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
                this.showToast('success', 'Ticket saved successfully!');
                this.reset();
              },
              error: (e) => {
                console.error('Create ticket failed', e);
                this.showToast('error', 'Failed to save ticket. Please try again.');
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed', e);
            this.showToast('error', 'Could not resolve trip. Check schedule/date.');
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
        this.cancelCancelAction();
        this.showToast('success', 'Ticket cancelled successfully.');
      },
      error: (e) => {
        console.error('Cancel failed', e);
        this.cancelCancelAction();
        this.showToast('error', 'Failed to cancel ticket. Please try again.');
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

    this.editingOriginalSeats = ticket.seatNumber
      ? ticket.seatNumber.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    this.editSeatsPreSelected = false;

    const trip = this.trips.find((t) => t.id === ticket.tripId);
    if (trip) {
      const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
      if (schedule) {
        this.selectedRouteCode = String(schedule.routeId);

        const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
        if (vehicle) {
          this.selectedVehicleCode = vehicle.vehicleCode;
          this.editingOriginalVehicleId = vehicle.id;
        }

        const tripDate = new Date(trip.tripDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        this.selectedDepartureDate = `${tripDate.getFullYear()}-${pad(tripDate.getMonth() + 1)}-${pad(tripDate.getDate())}`;

        this._populateVehiclesAndArrivalDate();

        this.selectedBaseFare = schedule.baseFare;
      }
    }

    if (ticket.bookingDateTime) {
      this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(0, 10);
    }

    this.showModal = true;
  }

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

  // ── Toast system ──────────────────────────────────────────────────────────────

  toasts: { id: number; type: 'success' | 'error' | 'warn' | 'info'; message: string }[] = [];
  private _toastId = 0;

  showToast(
    type: 'success' | 'error' | 'warn' | 'info',
    message: string,
    durationMs = 2500,
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

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.tickets.sort((a, b) => {
      const valA = (a as any)[field]?.toString().toLowerCase() ?? '';
      const valB = (b as any)[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    this.updatePagination();
  }
}