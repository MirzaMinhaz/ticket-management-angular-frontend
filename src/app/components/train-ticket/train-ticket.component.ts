// train-ticket.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
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
  LocationDto,
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketService } from '../../services/ticket.service';
import { TripService } from '../../services/trip.service';
import { LocationService } from '../../services/location.service';
import { SeatLockService } from '../../services/seat-lock.service';
import { getUserRole, getUserName } from '../../utils/auth.utils';

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

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TrainClassType = 'AC Berth' | 'Snigdha' | 'Shovon' | 'Regular';
export type BerthPosition =
  | 'Lower'
  | 'Middle'
  | 'Upper'
  | 'Side Lower'
  | 'Side Upper';

export interface TrainClassConfig {
  classType: TrainClassType;
  bogieCount: number;
  capacityPerBogie: number;
  fare: number;
  availableSeats: number;
}

export interface TrainSeatDto extends SeatDto {
  classType: TrainClassType;
  bogieIndex: number;
  compartmentIndex?: number;
  berthPosition?: BerthPosition;
}

export interface BerthCompartment {
  compartmentName: string;
  seats: TrainSeatDto[];
  availableCount: number;
  totalCount: number;
}

export interface TrainBogie {
  bogieName: string;
  classType: TrainClassType;
  bogieIndex: number;
  seats: TrainSeatDto[];
  compartments: BerthCompartment[];
  availableCount: number;
}

export interface TrainTicketDto extends TicketDto {
  trainClass?: string;
}

// ─── Time-of-day filter buckets ──────────────────────────────────────────────
type TimeCategory = 'Dawn' | 'Morning' | 'Afternoon' | 'Evening' | 'Night';

const TIME_CATEGORY_ORDER: TimeCategory[] = [
  'Dawn',
  'Morning',
  'Afternoon',
  'Evening',
  'Night',
];

const TIME_CATEGORY_LABELS: Record<TimeCategory, string> = {
  Dawn: 'Dawn · 4–9 AM',
  Morning: 'Morning · 9 AM–1 PM',
  Afternoon: 'Afternoon · 1–6 PM',
  Evening: 'Evening · 6–9 PM',
  Night: 'Night · 9 PM–4 AM',
};

const TIME_CATEGORY_ICONS: Record<TimeCategory, string> = {
  Dawn: '🌅',
  Morning: '☀️',
  Afternoon: '🌤️',
  Evening: '🌇',
  Night: '🌙',
};

export interface FilterOption {
  value: string;
  label: string;
  icon: string;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BERTHS_PER_COMPARTMENT = 6;
const BERTH_POSITIONS: BerthPosition[] = [
  'Lower',
  'Middle',
  'Upper',
  'Side Lower',
  'Side Upper',
  'Lower',
];

@Component({
  selector: 'app-train-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './train-ticket.component.html',
  styleUrls: ['./train-ticket.component.css'],
})
export class TrainTicketComponent implements OnInit, OnDestroy {
  // ── Data lists ───────────────────────────────────────────────────────────────
  tickets: TrainTicketDto[] = [];
  paginatedTickets: TrainTicketDto[] = [];
  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  counters: TicketCounterDto[] = [];
  availableVehicles: Vehicle[] = [];
  trips: TripDto[] = [];
  locations: LocationDto[] = [];

  // ── Form state ───────────────────────────────────────────────────────────────
  selectedTicket: TrainTicketDto = this.emptyTicket();
  selectedRouteCode: string = '';
  selectedFromLocation: string = '';
  selectedToLocation: string = '';
  selectedVehicleCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

  // ── UI ───────────────────────────────────────────────────────────────────────
  showModal = false;
  showCancelConfirmModal = false;
  ticketToCancel: TrainTicketDto | null = null;
  cancelReason = 'Counter request';

  // ── Pagination / sort ────────────────────────────────────────────────────────
  currentPage = 1;
  itemsPerPage = 25;
  totalPages = 1;
  pages: number[] = [];
  sortField = '';
  sortAsc = true;
  isAdmin: boolean = false;

  // ── Seat panel state ─────────────────────────────────────────────────────────
  seatBookingBusId: number | null = null;
  seatPanelLoading = false;
  selectedSeats: TrainSeatDto[] = [];
  activeClassTab: TrainClassType | '' = '';
  trainClasses: TrainClassConfig[] = [];

  private vehicleClassConfigs: Record<number, TrainClassConfig[]> = {};
  private bogiesByClass: Record<string, TrainBogie[]> = {};
  private seatMap: Record<string, TrainSeatDto> = {};
  private liveBookedSeats: string[] = [];
  private activeTripId: number | null = null;
  private availableSeatCounts: Record<number, number> = {};

  // ── Edit-mode helpers ────────────────────────────────────────────────────────
  private editingOriginalSeats: string[] = [];
  private editingOriginalVehicleId: number | null = null;
  private editSeatsPreSelected = false;

  // ── SignalR subscriptions ─────────────────────────────────────────────────────
  private signalrSubs: Subscription[] = [];

  // ── Search ────────────────────────────────────────────────────────────────────
  passengerSearch = '';

  // ── Vehicle filter state ─────────────────────────────────────────────────────
  selectedClassFilters: Set<string> = new Set();
  selectedTimeFilters: Set<string> = new Set();

  // ── Toast ─────────────────────────────────────────────────────────────────────
  toasts: {
    id: number;
    type: 'success' | 'error' | 'warn' | 'info';
    message: string;
  }[] = [];
  private _toastId = 0;

  // ─────────────────────────────────────────────────────────────────────────────

  constructor(
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ticketCounterService: TicketCounterService,
    private ticketService: TicketService,
    private tripService: TripService,
    private locationService: LocationService,
    private seatLockService: SeatLockService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    this.isAdmin = getUserRole() === 'Admin';

    this.loadAll();

    try {
      await this.seatLockService.startConnection(
        'https://localhost:7139/hubs/seats',
      );
      this._wireSignalREvents();
    } catch {
      console.warn(
        '[TrainTicket] SignalR unavailable; real-time seat locking disabled.',
      );
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.signalrSubs.forEach((s) => s.unsubscribe());
    if (this.activeTripId !== null) {
      await this.seatLockService.leaveTrip(this.activeTripId);
    }
  }

  // ── SignalR event wiring ──────────────────────────────────────────────────────

  private _wireSignalREvents(): void {
    this.signalrSubs.push(
      this.seatLockService.seatLocked$.subscribe(
        ({ tripId, seatNumber, connectionId }) => {
          if (tripId !== this.activeTripId) return;
          if (connectionId === this.seatLockService.connectionId) return;
          const seat = this.seatMap[seatNumber];
          if (seat && seat.status === 'available') {
            seat.status = 'locked';
            this._refreshBogieAvailCounts();
          }
        },
      ),
    );

    // Fires the moment ANY agent/customer successfully saves a ticket for
    // seats on this trip — including seats this client never touched.
    // This is what makes booking real-time: the seat flips straight to
    // "Taken" for everyone with the panel open, no refresh needed.
    this.signalrSubs.push(
      this.seatLockService.seatsBooked$.subscribe(({ tripId, seatNumbers }) => {
        if (tripId !== this.activeTripId) return;

        for (const seatNumber of seatNumbers) {
          const seat = this.seatMap[seatNumber];
          if (!seat) continue;
          seat.status = 'reserved';
          seat.isBooked = true;
          // Defensive: drop it from our own selection if it was somehow
          // still selected, so fare/seat-number fields stay consistent.
          this.selectedSeats = this.selectedSeats.filter(
            (s) => s.seatNumber !== seatNumber,
          );
        }

        this._refreshBogieAvailCounts();
      }),
    );

    this.signalrSubs.push(
      this.seatLockService.seatReleased$.subscribe(({ tripId, seatNumber }) => {
        if (tripId !== this.activeTripId) return;
        const seat = this.seatMap[seatNumber];
        if (seat && seat.status === 'locked') {
          seat.status = 'available';
          this._refreshBogieAvailCounts();
        }
      }),
    );

    this.signalrSubs.push(
      this.seatLockService.lockFailed$.subscribe(({ seatNumber, reason }) => {
        const seat = this.seatMap[seatNumber];
        if (seat) {
          if (seat.status === 'selected') {
            this.selectedSeats = this.selectedSeats.filter(
              (s) => s.seatNumber !== seatNumber,
            );
            this.updateSeatNumberField();
          }
          seat.status = 'locked';
        }
        this.showToast('warn', `Seat ${seatNumber}: ${reason}`);
        this._refreshBogieAvailCounts();
      }),
    );

    // Fires the moment ANY agent/customer successfully saves a ticket for
    // seats on this trip — including seats this same client never touched.
    // This is what makes booking real-time: the seat flips straight to
    // "Taken" for everyone with the panel open, no refresh needed.
    this.signalrSubs.push(
      this.seatLockService.seatsBooked$.subscribe(({ tripId, seatNumbers }) => {
        if (tripId !== this.activeTripId) return;

        for (const seatNumber of seatNumbers) {
          const seat = this.seatMap[seatNumber];
          if (!seat) continue;
          seat.status = 'reserved';
          seat.isBooked = true;
          // Defensive: if this seat was somehow still in our own selection,
          // drop it so the fare/seat-number fields don't reference a seat
          // that's no longer selectable.
          this.selectedSeats = this.selectedSeats.filter(
            (s) => s.seatNumber !== seatNumber,
          );
        }

        this._refreshBogieAvailCounts();
      }),
    );
  }

  private _refreshBogieAvailCounts(): void {
    for (const classType of Object.keys(this.bogiesByClass)) {
      for (const bogie of this.bogiesByClass[classType]) {
        bogie.availableCount = bogie.seats.filter(
          (s) => s.status === 'available',
        ).length;
        for (const comp of bogie.compartments) {
          comp.availableCount = comp.seats.filter(
            (s) => s.status === 'available',
          ).length;
        }
      }
    }
    for (const cfg of this.trainClasses) {
      const bogies = this.bogiesByClass[cfg.classType] ?? [];
      cfg.availableSeats = bogies.reduce((sum, b) => sum + b.availableCount, 0);
    }

    // Keep the vehicle-card "X seats left" badge in sync too, for whoever
    // currently has this vehicle's seat panel open.
    if (this.seatBookingBusId !== null) {
      const totalAvail = this.trainClasses.reduce(
        (s, c) => s + c.availableSeats,
        0,
      );
      this.availableSeatCounts[this.seatBookingBusId] = totalAvail;
    }
  }

  // ── Data loaders ─────────────────────────────────────────────────────────────

  private loadAll(): void {
    this.routeService.getAllRoutes().subscribe({
      next: (d) => (this.routes = d),
      error: (e) => console.error(e),
    });
    this.operatorService.getAll().subscribe({
      next: (d) => (this.operators = d),
      error: (e) => console.error(e),
    });
    this.scheduleService.getAllSchedules().subscribe({
      next: (d) => (this.schedules = d),
      error: (e) => console.error(e),
    });
    this.ticketCounterService.getAllTicketCounters().subscribe({
      next: (d) => (this.counters = d),
      error: (e) => console.error(e),
    });
    this.locationService.getAllLocations().subscribe({
      next: (d) => (this.locations = d),
      error: (e) => console.error(e),
    });

    forkJoin({
      trips: this.tripService.getAll(),
      vehicles: this.vehicleService.getAll(),
    }).subscribe({
      next: ({ trips, vehicles }) => {
        this.trips = trips;
        this.vehicles = vehicles;
        this.loadTickets();
      },
      error: (e) => console.error(e),
    });
  }

  loadTickets(): void {
    this.ticketService.getTickets().subscribe({
      next: (d) => {
        const allTickets = d as TrainTicketDto[];

        this.tickets = allTickets.filter((ticket) => {
          const trip = this.trips.find((t) => t.id === ticket.tripId);
          if (!trip) return false;
          const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
          if (!schedule) return false;
          const vehicle = this.vehicles.find(
            (v) => v.id === schedule.vehicleId,
          );
          return vehicle?.type === 'Train';
        });

        this.updatePagination();
      },
      error: (e) => console.error(e),
    });
  }

  // ── From / To (route picker) ─────────────────────────────────────────────────

  /** All unique locations that are a valid departure ("From") point on some route. */
  get fromLocations(): LocationDto[] {
    const codes = new Set(this.routes.map((r) => r.departureLocationCode));
    return this.locations
      .filter((l) => codes.has(l.locationCode ?? ''))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Locations reachable ("To") from the currently selected From location. */
  get toLocations(): LocationDto[] {
    if (!this.selectedFromLocation) return [];
    const codes = new Set(
      this.routes
        .filter((r) => r.departureLocationCode === this.selectedFromLocation)
        .map((r) => r.destinationLocationCode),
    );
    return this.locations
      .filter((l) => codes.has(l.locationCode ?? ''))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  onFromLocationChange(): void {
    this.selectedToLocation = '';
    this.selectedRouteCode = '';
    this.availableVehicles = [];
    this.selectedArrivalDate = '';
    this.clearAllFilters();
    this.closeSeatPanel();
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.trainClass = '';
    this.selectedTicket.farePaid = 0;
  }

  onToLocationChange(): void {
    const route = this.routes.find(
      (r) =>
        r.departureLocationCode === this.selectedFromLocation &&
        r.destinationLocationCode === this.selectedToLocation,
    );

    if (!route) {
      this.selectedRouteCode = '';
      this.availableVehicles = [];
      this.showToast('error', 'No route found for this From/To combination.');
      return;
    }

    this.selectedRouteCode = String(route.id);
    this.calculateArrivalDate();
  }

  swapLocations(): void {
    if (!this.selectedFromLocation || !this.selectedToLocation) return;

    const newFrom = this.selectedToLocation;
    const hasReverseRoute = this.routes.some(
      (r) => r.departureLocationCode === newFrom,
    );
    if (!hasReverseRoute) {
      this.showToast(
        'warn',
        'No return route available from this destination.',
      );
      return;
    }

    const newTo = this.selectedFromLocation;
    this.selectedFromLocation = newFrom;
    this.selectedToLocation = newTo;
    this.onToLocationChange();
  }

  /** Sets From/To selects to match a route id (used when opening the edit modal). */
  private syncFromToWithRoute(routeId: number | string | null): void {
    const route = this.routes.find((r) => r.id === Number(routeId));
    if (route) {
      this.selectedFromLocation = route.departureLocationCode;
      this.selectedToLocation = route.destinationLocationCode;
    } else {
      this.selectedFromLocation = '';
      this.selectedToLocation = '';
    }
  }

  getLocationName(locationCode: string | undefined): string {
    if (!locationCode) return '';
    return (
      this.locations.find((l) => l.locationCode === locationCode)?.name ??
      locationCode
    );
  }

  // ── Vehicle filters ──────────────────────────────────────────────────────────

  clearAllFilters(): void {
    this.selectedClassFilters.clear();
    this.selectedTimeFilters.clear();
  }

  get hasActiveFilters(): boolean {
    return (
      this.selectedClassFilters.size > 0 || this.selectedTimeFilters.size > 0
    );
  }

  toggleClassFilter(value: string): void {
    if (this.selectedClassFilters.has(value))
      this.selectedClassFilters.delete(value);
    else this.selectedClassFilters.add(value);
  }

  toggleTimeFilter(value: string): void {
    if (this.selectedTimeFilters.has(value))
      this.selectedTimeFilters.delete(value);
    else this.selectedTimeFilters.add(value);
  }

  private classifyTimeCategory(minutes: number): TimeCategory {
    if (minutes >= 240 && minutes < 540) return 'Dawn';
    if (minutes >= 540 && minutes < 780) return 'Morning';
    if (minutes >= 780 && minutes < 1080) return 'Afternoon';
    if (minutes >= 1080 && minutes < 1260) return 'Evening';
    return 'Night';
  }

  getTimeCategoryForVehicle(vehicleId: number): TimeCategory {
    const s = this.schedules.find(
      (s) =>
        s.vehicleId === vehicleId &&
        s.routeId === Number(this.selectedRouteCode),
    );
    return this.classifyTimeCategory(this.getDepartureMinutes(s));
  }

  getTimeCategoryIcon(vehicleId: number): string {
    return TIME_CATEGORY_ICONS[this.getTimeCategoryForVehicle(vehicleId)];
  }

  getTimeCategoryShortLabel(vehicleId: number): string {
    return this.getTimeCategoryForVehicle(vehicleId);
  }

  /** Train class filter options — only classes actually offered by at least one available train, with counts. */
  get classFilterOptions(): FilterOption[] {
    const map = new Map<string, number>();
    for (const v of this.availableVehicles) {
      for (const cfg of this.getTrainClasses(v)) {
        map.set(cfg.classType, (map.get(cfg.classType) ?? 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([value, count]) => ({
        value,
        label: value,
        icon: this.getClassIcon(value),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Departure-time filter options — only time buckets that actually have a train, in day order. */
  get timeFilterOptions(): FilterOption[] {
    const map = new Map<TimeCategory, number>();
    for (const v of this.availableVehicles) {
      const cat = this.getTimeCategoryForVehicle(v.id);
      map.set(cat, (map.get(cat) ?? 0) + 1);
    }
    return TIME_CATEGORY_ORDER.filter((cat) => map.has(cat)).map((cat) => ({
      value: cat,
      label: TIME_CATEGORY_LABELS[cat],
      icon: TIME_CATEGORY_ICONS[cat],
      count: map.get(cat)!,
    }));
  }

  /** Final train list shown to the agent — filtered by active filters, already time-sorted from availableVehicles. */
  get filteredVehicles(): Vehicle[] {
    return this.availableVehicles.filter((v) => {
      if (this.selectedClassFilters.size) {
        const offeredClasses = this.getTrainClasses(v).map((c) => c.classType);
        const matchesClass = offeredClasses.some((c) =>
          this.selectedClassFilters.has(c),
        );
        if (!matchesClass) return false;
      }
      if (this.selectedTimeFilters.size) {
        const cat = this.getTimeCategoryForVehicle(v.id);
        if (!this.selectedTimeFilters.has(cat)) return false;
      }
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRAIN CLASS HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  getTrainClasses(vehicle: Vehicle): TrainClassConfig[] {
    if (this.vehicleClassConfigs[vehicle.id])
      return this.vehicleClassConfigs[vehicle.id];
    const schedule = this.schedules.find(
      (s) =>
        s.vehicleId === vehicle.id &&
        s.routeId === Number(this.selectedRouteCode),
    );
    const baseFare = schedule?.baseFare ?? 300;
    const configs: TrainClassConfig[] = [
      {
        classType: 'AC Berth',
        bogieCount: 3,
        capacityPerBogie: 42,
        fare: Math.round(baseFare * 3.5),
        availableSeats: 0,
      },
      {
        classType: 'Snigdha',
        bogieCount: 2,
        capacityPerBogie: 40,
        fare: Math.round(baseFare * 2.5),
        availableSeats: 0,
      },
      {
        classType: 'Shovon',
        bogieCount: 3,
        capacityPerBogie: 44,
        fare: Math.round(baseFare * 1.2),
        availableSeats: 0,
      },
      {
        classType: 'Regular',
        bogieCount: 2,
        capacityPerBogie: 60,
        fare: baseFare,
        availableSeats: 0,
      },
    ];
    configs.forEach((cfg) => {
      cfg.availableSeats = cfg.bogieCount * cfg.capacityPerBogie;
    });
    this.vehicleClassConfigs[vehicle.id] = configs;
    return configs;
  }

  getMinFareForVehicle(vehicleId: number): number {
    const v = this.vehicles.find((v) => v.id === vehicleId);
    if (!v) return 0;
    return Math.min(...this.getTrainClasses(v).map((c) => c.fare));
  }

  getTotalAvailableSeats(vehicleId: number): number {
    if (vehicleId in this.availableSeatCounts)
      return this.availableSeatCounts[vehicleId];
    const v = this.vehicles.find((v) => v.id === vehicleId);
    if (!v) return 0;
    return this.getTrainClasses(v).reduce(
      (s, c) => s + c.bogieCount * c.capacityPerBogie,
      0,
    );
  }

  isBerthClass(classType: string): boolean {
    return classType === 'AC Berth';
  }

  getClassIcon(classType: string): string {
    return (
      ({ 'AC Berth': '🛏️', Snigdha: '❄️', Shovon: '💺', Regular: '🪑' } as any)[
        classType
      ] ?? '💺'
    );
  }

  getClassTagCss(classType: string): string {
    return (
      (
        {
          'AC Berth': 'cls-ac-berth',
          Snigdha: 'cls-snigdha',
          Shovon: 'cls-shovon',
          Regular: 'cls-regular',
        } as any
      )[classType] ?? ''
    );
  }

  getClassTabCss(classType: string): string {
    return 'class-tab--' + classType.toLowerCase().replace(' ', '-');
  }

  getBerthPositionIcon(pos: string | undefined): string {
    return (
      (
        {
          Lower: '⬇️',
          Middle: '↔️',
          Upper: '⬆️',
          'Side Lower': '◀️',
          'Side Upper': '🔼',
        } as any
      )[pos ?? ''] ?? '🛏️'
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEAT PANEL — OPEN / CLOSE
  // ─────────────────────────────────────────────────────────────────────────────

  async openSeatPanel(vehicleCode: string, vehicleId: number): Promise<void> {
    if (this.seatBookingBusId === vehicleId) {
      await this.closeSeatPanel();
      return;
    }

    if (!this.selectedRouteCode) {
      this.showToast('error', 'Please select From and To first.');
      return;
    }
    if (!this.selectedDepartureDate) {
      this.showToast('error', 'Please select a departure date first.');
      return;
    }

    this.selectedVehicleCode = vehicleCode;
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;
    this.selectedSeats = [];
    this.seatMap = {};
    this.bogiesByClass = {};
    this.activeClassTab = '';

    const vehicle = this.vehicles.find((v) => v.id === vehicleId);
    const schedule = this.schedules.find(
      (s) =>
        s.vehicleId === vehicleId &&
        s.routeId === Number(this.selectedRouteCode),
    );

    if (!vehicle || !schedule) {
      this.showToast(
        'error',
        'Could not find vehicle or schedule information.',
      );
      this.seatPanelLoading = false;
      return;
    }

    this.trainClasses = this.getTrainClasses(vehicle);
    this.selectedBaseFare = this.trainClasses[0]?.fare ?? 0;

    this.tripService
      .findOrCreate({
        scheduleId: schedule.id,
        tripDate: this.selectedDepartureDate,
      })
      .subscribe({
        next: async (trip) => {
          this.activeTripId = trip.id;

          if (this.seatLockService.isConnected) {
            await this.seatLockService.joinTrip(trip.id);
          }

          this.tripService.getBookedSeats(trip.id).subscribe({
            next: async (booked) => {
              this.liveBookedSeats = this.showModal
                ? booked.filter((s) => !this.editingOriginalSeats.includes(s))
                : booked;

              this.buildAllBogies(vehicle);

              if (this.seatLockService.isConnected) {
                await this._applyLockedSeatsSnapshot(trip.id);
              }

              this.trainClasses.forEach((cfg) => {
                cfg.availableSeats = (
                  this.bogiesByClass[cfg.classType] ?? []
                ).reduce((s, b) => s + b.availableCount, 0);
              });
              const totalAvail = this.trainClasses.reduce(
                (s, c) => s + c.availableSeats,
                0,
              );
              this.availableSeatCounts[vehicleId] = totalAvail;

              const firstAvail = this.trainClasses.find(
                (c) => c.availableSeats > 0,
              );
              this.activeClassTab =
                firstAvail?.classType ?? this.trainClasses[0]?.classType ?? '';
              this.selectedBaseFare =
                this.trainClasses.find(
                  (c) => c.classType === this.activeClassTab,
                )?.fare ?? 0;

              if (
                this.showModal &&
                !this.editSeatsPreSelected &&
                this.editingOriginalVehicleId === vehicleId
              ) {
                this.editSeatsPreSelected = true;
                for (const seatNum of this.editingOriginalSeats) {
                  const seat = this.seatMap[seatNum];
                  if (seat && seat.status === 'available') {
                    seat.status = 'selected';
                    this.selectedSeats.push(seat);
                    this.activeClassTab = seat.classType;
                  }
                }
                this.updateSeatNumberField();
              }

              this.seatPanelLoading = false;
            },
            error: (e) => {
              console.error(e);
              this.seatPanelLoading = false;
            },
          });
        },
        error: (e) => {
          console.error(e);
          this.seatPanelLoading = false;
        },
      });
  }

  private _applyLockedSeatsSnapshot(tripId: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const TIMEOUT_MS = 3_000;

      const timer = setTimeout(() => {
        sub.unsubscribe();
        console.warn(
          '[TrainTicket] Snapshot timeout — proceeding without locked seats.',
        );
        resolve();
      }, TIMEOUT_MS);

      const sub = this.seatLockService.lockedSeatsSnapshot$.subscribe(
        ({ tripId: tid, seats }) => {
          if (tid !== tripId) return;

          clearTimeout(timer);
          sub.unsubscribe();

          for (const { seatNumber, connectionId } of seats) {
            if (connectionId === this.seatLockService.connectionId) continue;
            const seat = this.seatMap[seatNumber];
            if (seat && seat.status === 'available') {
              seat.status = 'locked';
            }
          }

          this._refreshBogieAvailCounts();
          resolve();
        },
      );

      this.seatLockService.getLockedSeats(tripId);
    });
  }

  async closeSeatPanel(releaseLocks: boolean = true): Promise<void> {
    if (this.activeTripId !== null && this.seatLockService.isConnected) {
      if (releaseLocks) {
        for (const seat of this.selectedSeats) {
          await this.seatLockService.releaseSeat(
            this.activeTripId,
            seat.seatNumber,
          );
        }
      }
      await this.seatLockService.leaveTrip(this.activeTripId);
    }

    this.seatBookingBusId = null;
    this.activeTripId = null;
    this.liveBookedSeats = [];
    this.selectedSeats = [];
    this.seatMap = {};
    this.bogiesByClass = {};
    this.trainClasses = [];
    this.activeClassTab = '';
    this.seatPanelLoading = false;
  }

  setActiveClassTab(classType: TrainClassType): void {
    this.activeClassTab = classType;
    const cfg = this.trainClasses.find((c) => c.classType === classType);
    if (cfg) this.selectedBaseFare = cfg.fare;
  }

  getActiveBogies(): TrainBogie[] {
    return this.bogiesByClass[this.activeClassTab] ?? [];
  }

  isCompartmentSelected(comp: BerthCompartment): boolean {
    return comp.seats.some((s) => s.status === 'selected');
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEAT GENERATION
  // ─────────────────────────────────────────────────────────────────────────────

  private buildAllBogies(vehicle: Vehicle): void {
    this.bogiesByClass = {};
    this.seatMap = {};
    let globalSeatNum = 1;

    for (const cfg of this.trainClasses) {
      const bogies: TrainBogie[] = [];

      for (let bi = 0; bi < cfg.bogieCount; bi++) {
        const bogie: TrainBogie = {
          bogieName: `${cfg.classType} Bogie ${bi + 1}`,
          classType: cfg.classType,
          bogieIndex: bi,
          seats: [],
          compartments: [],
          availableCount: 0,
        };

        if (this.isBerthClass(cfg.classType)) {
          const compartmentCount = Math.floor(
            cfg.capacityPerBogie / BERTHS_PER_COMPARTMENT,
          );
          for (let ci = 0; ci < compartmentCount; ci++) {
            const comp: BerthCompartment = {
              compartmentName: `Compartment ${ci + 1}`,
              seats: [],
              availableCount: 0,
              totalCount: BERTHS_PER_COMPARTMENT,
            };
            for (let si = 0; si < BERTHS_PER_COMPARTMENT; si++) {
              const seatNum = `B${globalSeatNum}`;
              const isBooked = this.liveBookedSeats.includes(seatNum);
              const seat: TrainSeatDto = {
                id: globalSeatNum,
                seatNumber: seatNum,
                seatCode: seatNum,
                isBooked,
                status: isBooked ? 'reserved' : 'available',
                classType: cfg.classType,
                bogieIndex: bi,
                compartmentIndex: ci,
                berthPosition: BERTH_POSITIONS[si % BERTH_POSITIONS.length],
              };
              comp.seats.push(seat);
              bogie.seats.push(seat);
              this.seatMap[seatNum] = seat;
              if (!isBooked) {
                comp.availableCount++;
                bogie.availableCount++;
              }
              globalSeatNum++;
            }
            bogie.compartments.push(comp);
          }
        } else {
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const rowCount = Math.ceil(cfg.capacityPerBogie / 4);
          let seatInBogie = 0;
          for (
            let ri = 0;
            ri < rowCount && seatInBogie < cfg.capacityPerBogie;
            ri++
          ) {
            for (
              let col = 1;
              col <= 4 && seatInBogie < cfg.capacityPerBogie;
              col++
            ) {
              const seatNum = `${cfg.classType.charAt(0)}${bi + 1}-${alphabet[ri]}${col}`;
              const isBooked = this.liveBookedSeats.includes(seatNum);
              const seat: TrainSeatDto = {
                id: globalSeatNum,
                seatNumber: seatNum,
                seatCode: seatNum,
                isBooked,
                status: isBooked ? 'reserved' : 'available',
                classType: cfg.classType,
                bogieIndex: bi,
                berthPosition: undefined,
              };
              bogie.seats.push(seat);
              this.seatMap[seatNum] = seat;
              if (!isBooked) bogie.availableCount++;
              globalSeatNum++;
              seatInBogie++;
            }
          }
        }

        bogies.push(bogie);
      }

      this.bogiesByClass[cfg.classType] = bogies;
    }
  }

  getBogieSeatRows(bogie: TrainBogie): string[] {
    const prefix = `${bogie.classType.charAt(0)}${bogie.bogieIndex + 1}-`;
    const rows = new Set<string>();
    for (const seat of bogie.seats)
      rows.add(seat.seatNumber.replace(prefix, '').charAt(0));
    return Array.from(rows);
  }

  getSeatByBogiePosition(
    bogie: TrainBogie,
    row: string,
    col: number,
  ): TrainSeatDto | undefined {
    return this.seatMap[
      `${bogie.classType.charAt(0)}${bogie.bogieIndex + 1}-${row}${col}`
    ];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOGGLE SEAT
  // ─────────────────────────────────────────────────────────────────────────────

  async toggleSeat(seat: TrainSeatDto): Promise<void> {
    if (!seat || seat.status === 'reserved' || seat.status === 'locked') return;
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

      if (this.activeTripId !== null && this.seatLockService.isConnected) {
        await this.seatLockService.releaseSeat(
          this.activeTripId,
          seat.seatNumber,
        );
      }
    } else {
      if (this.selectedSeats.length >= 6) {
        this.showToast('warn', 'Maximum 6 seats can be booked per ticket.');
        return;
      }
      if (
        this.selectedSeats.length > 0 &&
        this.selectedSeats[0].classType !== mapSeat.classType
      ) {
        this.showToast(
          'warn',
          'All seats must be from the same class in one ticket.',
        );
        return;
      }

      if (this.activeTripId !== null && this.seatLockService.isConnected) {
        mapSeat.status = 'selected';
        this.selectedSeats = [...this.selectedSeats, mapSeat];
        await this.seatLockService.lockSeat(this.activeTripId, seat.seatNumber);
      } else {
        mapSeat.status = 'selected';
        this.selectedSeats = [...this.selectedSeats, mapSeat];
      }
    }

    if (this.selectedSeats.length > 0) {
      this.activeClassTab = this.selectedSeats[0].classType;
      this.selectedBaseFare =
        this.trainClasses.find((c) => c.classType === this.activeClassTab)
          ?.fare ?? 0;
    }

    this.updateSeatNumberField();
    this._refreshBogieAvailCounts();
  }

  async clearSelection(releaseLocks: boolean = true): Promise<void> {
    for (const s of this.selectedSeats) {
      if (s.status !== 'reserved') s.status = 'available';
      if (
        releaseLocks &&
        this.activeTripId !== null &&
        this.seatLockService.isConnected
      ) {
        await this.seatLockService.releaseSeat(this.activeTripId, s.seatNumber);
      }
    }
    this.selectedSeats = [];
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.trainClass = '';
    this.selectedTicket.farePaid = 0;
    this._refreshBogieAvailCounts();
  }

  private updateSeatNumberField(): void {
    this.selectedTicket.seatNumber = this.selectedSeats
      .map((s) => s.seatNumber)
      .sort()
      .join(', ');
    this.selectedTicket.trainClass = this.selectedSeats[0]?.classType ?? '';
    this.selectedTicket.farePaid =
      this.selectedBaseFare * this.selectedSeats.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTE & DATE
  // ─────────────────────────────────────────────────────────────────────────────

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

    this.availableVehicles = this.vehicles
      .filter(
        (v) =>
          v.type === 'Train' &&
          this.schedules.some(
            (s) =>
              s.routeId === Number(this.selectedRouteCode) &&
              s.vehicleId === v.id,
          ),
      )
      .sort((a, b) => {
        const sA = this.schedules.find(
          (s) =>
            s.vehicleId === a.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        const sB = this.schedules.find(
          (s) =>
            s.vehicleId === b.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        return this.getDepartureMinutes(sA) - this.getDepartureMinutes(sB);
      });

    this.clearAllFilters();

    this.closeSeatPanel();
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.trainClass = '';
    this.selectedTicket.farePaid = 0;
    this.selectedVehicleCode = '';
    this.selectedBaseFare = 0;
    this.vehicleClassConfigs = {};
    this.editSeatsPreSelected = false;
    this.refreshAvailableSeatCounts();
  }

  private getDepartureMinutes(schedule: ScheduleDto | undefined): number {
    if (!schedule?.departureDateTime) return Infinity;
    const raw = schedule.departureDateTime.toString().trim();
    const iso = raw.match(/T(\d{1,2}):(\d{2})/);
    if (iso) return parseInt(iso[1], 10) * 60 + parseInt(iso[2], 10);
    const h24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
    const h12 = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (h12) {
      let h = parseInt(h12[1], 10);
      const m = parseInt(h12[2], 10);
      if (h12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (h12[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }
    const d = new Date(raw);
    return isNaN(d.getTime()) ? Infinity : d.getHours() * 60 + d.getMinutes();
  }

  private refreshAvailableSeatCounts(): void {
    this.availableSeatCounts = {};
    for (const vehicle of this.availableVehicles) {
      const classes = this.getTrainClasses(vehicle);
      this.availableSeatCounts[vehicle.id] = classes.reduce(
        (sum, c) => sum + c.bogieCount * c.capacityPerBogie,
        0,
      );
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

  getSeatClass(vehicleId: number): string {
    const n = this.getTotalAvailableSeats(vehicleId);
    if (n === 0) return 'full';
    if (n < 20) return 'low';
    return 'high';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  getSelectedRoute(): RouteDto | undefined {
    return this.routes.find((r) => r.id === Number(this.selectedRouteCode));
  }

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
    return (
      this.routes.find((r) => r.id === schedule?.routeId)?.routeName ?? '—'
    );
  }

  getOperatorNameByTripId(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return '—';
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    const vehicle = this.vehicles.find((v) => v.id === schedule?.vehicleId);
    return (
      this.operators.find((o) => o.operatorCode === vehicle?.operatorCode)
        ?.name ?? '—'
    );
  }

  getVehicleModelByTripId(tripId: number): string {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return '';
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    return this.vehicles.find((v) => v.id === schedule?.vehicleId)?.model ?? '';
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

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE / UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  save(): void {
    const fail = (msg: string) => this.showToast('error', msg);
    if (!this.selectedTicket.passengerName?.trim())
      return fail('Please provide Passenger Name.');
    if (!this.selectedTicket.passengerContact?.trim())
      return fail('Please provide Passenger Contact.');
    if (!this.selectedTicket.seatNumber?.trim())
      return fail('Please select at least one seat.');

    const vehicleId = this.vehicles.find(
      (v) => v.vehicleCode === this.selectedVehicleCode,
    )?.id;
    const schedule = this.schedules.find(
      (s) =>
        s.routeId === Number(this.selectedRouteCode) &&
        s.vehicleId === vehicleId,
    );
    if (!schedule)
      return fail('Please select a valid train/route combination.');

    this.tripService
      .findOrCreate({
        scheduleId: schedule.id,
        tripDate: this.selectedDepartureDate,
      })
      .subscribe({
        next: (trip) => {
          if (this.selectedTicket.id) {
            const dto: UpdateTicketDto = {
              id: this.selectedTicket.id,
              tripId: trip.id,
              passengerName: this.selectedTicket.passengerName,
              passengerContact: this.selectedTicket.passengerContact,
              seatNumber: this.selectedTicket.seatNumber,
              farePaid: Number(this.selectedTicket.farePaid),
              bookingDateTime: this.selectedTicket.bookingDateTime,
              bookingCounterId: Number(
                this.selectedTicket.bookingCounterId ?? 0,
              ),
              departureCounterId: Number(
                this.selectedTicket.departureCounterId ?? 0,
              ),
              arrivalCounterId: Number(
                this.selectedTicket.arrivalCounterId ?? 0,
              ),
            };
            this.ticketService.updateTicket(dto).subscribe({
              next: async () => {
                // Broadcast the real booking state BEFORE any local cleanup runs.
                const finalSeats = this.selectedSeats.map((s) => s.seatNumber);
                const releasedSeats = this.editingOriginalSeats.filter(
                  (sn) => !finalSeats.includes(sn),
                );

                if (
                  this.activeTripId !== null &&
                  this.seatLockService.isConnected
                ) {
                  if (finalSeats.length) {
                    await this.seatLockService.confirmBooking(
                      this.activeTripId,
                      finalSeats,
                    );
                  }
                  // Seats that were dropped during this edit really are free now.
                  for (const sn of releasedSeats) {
                    await this.seatLockService.releaseSeat(
                      this.activeTripId,
                      sn,
                    );
                  }
                }

                this.loadTickets();
                this.editingOriginalSeats = [];
                this.editSeatsPreSelected = false;
                this.editingOriginalVehicleId = null;
                this.showToast('success', 'Train ticket updated successfully!');
                setTimeout(() => this.closeModal(false), 1500);
              },
              error: (e) => {
                console.error(e);
                if (e.status === 409) {
                  const conflictSeats: string[] =
                    e.error?.conflictingSeats ?? [];
                  this.showToast(
                    'error',
                    conflictSeats.length
                      ? `Seat(s) ${conflictSeats.join(', ')} were just booked by someone else. Refreshing availability…`
                      : 'One or more selected seats were just booked by someone else.',
                  );
                  // Re-open the seat panel fresh so the agent sees accurate, current
                  // availability instead of stale locally-cached seat state.
                  if (this.seatBookingBusId !== null) {
                    const vId = this.seatBookingBusId;
                    const vCode = this.selectedVehicleCode;
                    this.closeSeatPanel(false).then(() =>
                      this.openSeatPanel(vCode, vId),
                    );
                  }
                } else {
                  this.showToast(
                    'error',
                    'Failed to update ticket. Please try again.',
                  );
                }
              },
            });
          } else {
            const dto: CreateTicketDto = {
              tripId: trip.id,
              passengerName: this.selectedTicket.passengerName,
              passengerContact: this.selectedTicket.passengerContact,
              seatNumber: this.selectedTicket.seatNumber,
              farePaid: Number(this.selectedTicket.farePaid),
              bookingDateTime: this.selectedTicket.bookingDateTime,
              bookingCounterId: Number(
                this.selectedTicket.bookingCounterId ?? 0,
              ),
              departureCounterId: Number(
                this.selectedTicket.departureCounterId ?? 0,
              ),
              arrivalCounterId: Number(
                this.selectedTicket.arrivalCounterId ?? 0,
              ),
            };
            this.ticketService.createTicket(dto).subscribe({
              next: async () => {
                // Broadcast the real booking state BEFORE any local cleanup runs —
                // this is the fix: previously reset() → clearSelection() would call
                // releaseSeat() on these exact seats, broadcasting SeatReleased and
                // making them look free to every other agent/customer until they
                // happened to refetch bookedSeats from the database.
                const finalSeats = this.selectedSeats.map((s) => s.seatNumber);
                if (
                  this.activeTripId !== null &&
                  this.seatLockService.isConnected &&
                  finalSeats.length
                ) {
                  await this.seatLockService.confirmBooking(
                    this.activeTripId,
                    finalSeats,
                  );
                }

                this.loadTickets();
                this.showToast('success', 'Train ticket saved!');
                await this.reset(false);
              },
              error: (e) => {
                console.error(e);
                if (e.status === 409) {
                  const conflictSeats: string[] =
                    e.error?.conflictingSeats ?? [];
                  this.showToast(
                    'error',
                    conflictSeats.length
                      ? `Seat(s) ${conflictSeats.join(', ')} were just booked by someone else. Refreshing availability…`
                      : 'One or more selected seats were just booked by someone else.',
                  );
                  // Re-open the seat panel fresh so the agent sees accurate, current
                  // availability instead of stale locally-cached seat state.
                  if (this.seatBookingBusId !== null) {
                    const vId = this.seatBookingBusId;
                    const vCode = this.selectedVehicleCode;
                    this.closeSeatPanel(false).then(() =>
                      this.openSeatPanel(vCode, vId),
                    );
                  }
                } else {
                  this.showToast(
                    'error',
                    'Failed to save ticket. Please try again.',
                  );
                }
              },
            });
          }
        },
        error: (e) => {
          console.error(e);
          this.showToast('error', 'Could not resolve trip.');
        },
      });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CANCEL
  // ─────────────────────────────────────────────────────────────────────────────

  confirmCancel(ticket: TrainTicketDto): void {
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
        this.cancelCancelAction();
        this.showToast('success', 'Ticket cancelled.');
      },
      error: (e) => {
        console.error(e);
        this.cancelCancelAction();
        this.showToast('error', 'Failed to cancel ticket.');
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  emptyTicket(): TrainTicketDto {
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
      trainClass: '',
    };
  }

  /** @param releaseLocks Pass `false` right after a successful booking (see clearSelection). */
  async reset(releaseLocks: boolean = true): Promise<void> {
    await this.clearSelection(releaseLocks);
    this.selectedTicket = this.emptyTicket();
    const name = getUserName();
    if (name) this.selectedTicket.passengerName = name;
    this.selectedRouteCode = '';
    this.selectedFromLocation = '';
    this.selectedToLocation = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.vehicleClassConfigs = {};
    await this.closeSeatPanel(releaseLocks);
  }

  openModal(ticket: TrainTicketDto): void {
    this.selectedTicket = { ...ticket };
    this.editingOriginalSeats = ticket.seatNumber
      ? ticket.seatNumber
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    this.editSeatsPreSelected = false;

    const trip = this.trips.find((t) => t.id === ticket.tripId);
    if (trip) {
      const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
      if (schedule) {
        this.selectedRouteCode = String(schedule.routeId);
        this.syncFromToWithRoute(schedule.routeId);

        const vehicle = this.vehicles.find((v) => v.id === schedule.vehicleId);
        if (vehicle) {
          this.selectedVehicleCode = vehicle.vehicleCode;
          this.editingOriginalVehicleId = vehicle.id;
        }
        const tripDate = new Date(trip.tripDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        this.selectedDepartureDate = `${tripDate.getFullYear()}-${pad(tripDate.getMonth() + 1)}-${pad(tripDate.getDate())}`;
        this._populateVehiclesAndArrivalDate();
      }
    }
    if (ticket.bookingDateTime)
      this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(
        0,
        10,
      );
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
    this.availableVehicles = this.vehicles
      .filter(
        (v) =>
          v.type === 'Train' &&
          this.schedules.some(
            (s) =>
              s.routeId === Number(this.selectedRouteCode) &&
              s.vehicleId === v.id,
          ),
      )
      .sort((a, b) => {
        const sA = this.schedules.find(
          (s) =>
            s.vehicleId === a.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        const sB = this.schedules.find(
          (s) =>
            s.vehicleId === b.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        return this.getDepartureMinutes(sA) - this.getDepartureMinutes(sB);
      });
    this.clearAllFilters();
    this.refreshAvailableSeatCounts();
  }

  /** @param releaseLocks Pass `false` right after a successful booking (see clearSelection). */
  async closeModal(releaseLocks: boolean = true): Promise<void> {
    this.showModal = false;
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.clearAllFilters();
    await this.closeSeatPanel(releaseLocks);
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedFromLocation = '';
    this.selectedToLocation = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.vehicleClassConfigs = {};
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGINATION / SORT / SEARCH
  // ─────────────────────────────────────────────────────────────────────────────

  get filteredTickets(): TrainTicketDto[] {
    const q = this.passengerSearch.trim().toLowerCase();
    return q
      ? this.tickets.filter((t) => t.passengerName?.toLowerCase().includes(q))
      : this.tickets;
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination(): void {
    const source = this.filteredTickets;
    this.totalPages = Math.ceil(source.length / this.itemsPerPage) || 1;
    this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
    this.goToPage(this.currentPage);
  }

  goToPage(page: number): void {
    const source = this.filteredTickets;
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    const start = (page - 1) * this.itemsPerPage;
    this.paginatedTickets = source.slice(start, start + this.itemsPerPage);
  }

  goToPreviousPage(): void {
    this.goToPage(this.currentPage - 1);
  }
  goToNextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  sortBy(field: string): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.tickets.sort((a, b) => {
      const va = (a as any)[field]?.toString().toLowerCase() ?? '';
      const vb = (b as any)[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    this.currentPage = 1;
    this.updatePagination();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOAST
  // ─────────────────────────────────────────────────────────────────────────────

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

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}
