// customer-ticket.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isNonNull } from '../../utils/type-guards';
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
import { LocationService } from '../../services/location.service';
import { LocationDto } from '../../models/common';
// NOTE: getUserName is assumed to exist in auth.utils alongside getUserRole.
// If it doesn't yet, add it there using the same JWT-decode logic as
// getUserRole, returning the logged-in user's display name (e.g. `name` /
// `fullName` claim).
import { getUserRole, getUserName } from '../../utils/auth.utils';
import { RouterLink } from '@angular/router';

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

export type SeatLayoutMode = 'one-two' | 'two-two';

// ─── Time-of-day filter buckets ──────────────────────────────────────────────
type TimeCategory = 'Dawn' | 'Morning' | 'Afternoon' | 'Evening' | 'Night';

const TIME_CATEGORY_ORDER: TimeCategory[] = ['Dawn', 'Morning', 'Afternoon', 'Evening', 'Night'];

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

@Component({
  selector: 'app-customer-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-ticket.component.html',
  styleUrls: ['./customer-ticket.component.css'],
})
export class CustomerTicketComponent implements OnInit {
  // ── Role gate ────────────────────────────────────────────────────────────────
  /** True only when the logged-in user is Admin. Controls visibility of the ticket list/table. */
  isAdmin: boolean = false;

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
  locations: LocationDto[] = [];

  // ── Selected / form state ────────────────────────────────────────────────────
  selectedTicket: TicketDto = this.emptyTicket();
  selectedRouteCode: string = '';

  // From / To location filters that drive route selection.
  selectedFromLocation: string = '';
  selectedToLocation: string = '';
  fromLocationSearch: string = '';
  toLocationSearch: string = '';
  showFromSuggestions = false;
  showToSuggestions = false;

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

  seatLayoutMode: SeatLayoutMode = 'two-two';
  liveBookedSeats: string[] = [];
  private activeTripId: number | null = null;
  private availableSeatCounts: Record<number, number> = {};

  private editingOriginalSeats: string[] = [];
  private editingOriginalVehicleId: number | null = null;
  private editSeatsPreSelected = false;

  // ── Dual-deck state ───────────────────────────────────────────────────────
  lowerDeckSeats: SeatDto[] = [];
  upperDeckSeats: SeatDto[] = [];
  lowerRows: string[] = [];
  upperRows: string[] = [];
  isDualDeck = false;

  // ── Vehicle filter state ─────────────────────────────────────────────────────
  selectedAcFilters: Set<string> = new Set();
  selectedDeckFilters: Set<string> = new Set();
  selectedTimeFilters: Set<string> = new Set();

  constructor(
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private ticketCounterService: TicketCounterService,
    private ticketService: TicketService,
    private tripService: TripService,
    private locationService: LocationService,
  ) {}

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const today = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    this.isAdmin = getUserRole() === 'Admin';

    // Prefill passenger name for customers booking their own ticket.
    this.prefillPassengerNameIfCustomer();

    this.loadRoutes();
    this.loadVehicles();
    this.loadOperators();
    this.loadSchedules();
    this.loadCounters();
    this.loadTickets();
    this.loadTrips();
    this.loadLocations();
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

  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: (d) => (this.locations = d),
      error: (e) => console.error('Failed to load locations', e),
    });
  }

  // ── From / To (route picker) ─────────────────────────────────────────────────

  /** All unique locations that are a valid departure ("From") point on some route. */
  get fromLocations(): LocationDto[] {
    const codes = new Set(this.routes.map((r) => r.departureLocationCode));
    return this.locations.filter(
      (l) => isNonNull(l.locationCode) && codes.has(l.locationCode),
    );
  }

  /**
   * Locations reachable ("To") from the currently selected From location.
   * Purely derived from `routes` — never static, always follows the data.
   */
  get toLocations(): LocationDto[] {
    if (!this.selectedFromLocation) return [];
    const codes = new Set(
      this.routes
        .filter((r) => r.departureLocationCode === this.selectedFromLocation)
        .map((r) => r.destinationLocationCode),
    );
    return this.locations.filter(
      (l) => isNonNull(l.locationCode) && codes.has(l.locationCode),
    );
  }
    /** Locations matching what's currently typed in the From input. */
  get filteredFromLocations(): LocationDto[] {
    const q = this.fromLocationSearch.trim().toLowerCase();
    if (!q) return this.fromLocations;
    return this.fromLocations.filter((l) =>
      (l.name || '').toLowerCase().includes(q),
    );
  }

  /** Locations matching what's currently typed in the To input. */
  get filteredToLocations(): LocationDto[] {
    const q = this.toLocationSearch.trim().toLowerCase();
    if (!q) return this.toLocations;
    return this.toLocations.filter((l) =>
      (l.name || '').toLowerCase().includes(q),
    );
  }

  openFromSuggestions(): void {
    this.showFromSuggestions = true;
  }

  closeFromSuggestions(): void {
    this.showFromSuggestions = false;
  }

  openToSuggestions(): void {
    if (!this.selectedFromLocation) return;
    this.showToSuggestions = true;
  }

  closeToSuggestions(): void {
    this.showToSuggestions = false;
  }

  /** Fires on every keystroke in the From input. */
  onFromSearchChange(): void {
    this.showFromSuggestions = true;
    const current = this.locations.find(
      (l) => l.locationCode === this.selectedFromLocation,
    );
    if (this.selectedFromLocation && current?.name !== this.fromLocationSearch) {
      this.selectedFromLocation = '';
      this.onFromLocationChange();
    }
  }

  /** Fires on every keystroke in the To input. */
  onToSearchChange(): void {
    this.showToSuggestions = true;
    const current = this.locations.find(
      (l) => l.locationCode === this.selectedToLocation,
    );
    if (this.selectedToLocation && current?.name !== this.toLocationSearch) {
      this.selectedToLocation = '';
    }
  }

  selectFromLocation(loc: LocationDto): void {
    this.selectedFromLocation = loc.locationCode ?? '';
    this.fromLocationSearch = loc.name;
    this.showFromSuggestions = false;
    this.onFromLocationChange();
  }

  selectToLocation(loc: LocationDto): void {
    this.selectedToLocation = loc.locationCode ?? '';
    this.toLocationSearch = loc.name;
    this.showToSuggestions = false;
    this.onToLocationChange();
  }

  onFromLocationChange(): void {
    this.selectedToLocation = '';
    this.toLocationSearch = '';  
    this.selectedRouteCode = '';
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.selectedArrivalDate = '';
    this.clearAllFilters();
    this.closeSeatPanel();
    this.selectedTicket.seatNumber = '';
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

  /** Swaps From/To when a return route exists for the destination. */
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
    this.fromLocationSearch = this.getLocationName(newFrom);   // ← added
    this.toLocationSearch = this.getLocationName(newTo);       // ← added
    this.onToLocationChange();
  }

  /** Sets From/To selects to match a route id (used when opening the edit modal). */
    private syncFromToWithRoute(routeId: number | string | null): void {
    const route = this.routes.find((r) => r.id === Number(routeId));
    if (route) {
      this.selectedFromLocation = route.departureLocationCode;
      this.selectedToLocation = route.destinationLocationCode;
      this.fromLocationSearch = this.getLocationName(route.departureLocationCode);  // ← added
      this.toLocationSearch = this.getLocationName(route.destinationLocationCode);  // ← added
    } else {
      this.selectedFromLocation = '';
      this.selectedToLocation = '';
      this.fromLocationSearch = '';   // ← added
      this.toLocationSearch = '';     // ← added
    }
  }

  // ── Seat Layout Helpers ──────────────────────────────────────────────────────

  getLayoutModeForVehicle(vehicle: Vehicle): SeatLayoutMode {
    const isAC = vehicle.acType === 'AC';
    const capacity = vehicle.capacity ?? 0;
    if (isAC && capacity <= 35) return 'one-two';
    return 'two-two';
  }

  get leftCols(): number[] {
    return this.seatLayoutMode === 'one-two' ? [1] : [1, 2];
  }

  get rightCols(): number[] {
    return this.seatLayoutMode === 'one-two' ? [2, 3] : [3, 4];
  }

  get totalColsPerRow(): number {
    return this.seatLayoutMode === 'one-two' ? 3 : 4;
  }

  private isDualDeckVehicle(vehicle: Vehicle): boolean {
    const deck = (vehicle.deckLevel ?? '').toLowerCase();
    return (
      deck.includes('double') ||
      deck.includes('sleeper') ||
      deck === 'upper deck'
    );
  }

  private getDepartureMinutes(schedule: ScheduleDto | undefined): number {
    if (!schedule?.departureDateTime) return Infinity;
    const raw = schedule.departureDateTime.toString().trim();

    const isoMatch = raw.match(/T(\d{1,2}):(\d{2})/);
    if (isoMatch) {
      return parseInt(isoMatch[1], 10) * 60 + parseInt(isoMatch[2], 10);
    }

    const h24 = raw.match(/^(\d{1,2}):(\d{2})$/);
    if (h24) {
      return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);
    }

    const h12 = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (h12) {
      let h = parseInt(h12[1], 10);
      const m = parseInt(h12[2], 10);
      const period = h12[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    }

    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.getHours() * 60 + d.getMinutes();
    }

    return Infinity;
  }

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

  // ── Vehicle filters ──────────────────────────────────────────────────────────

  /** Resets all vehicle filters — called whenever the route/vehicle list changes. */
  clearAllFilters(): void {
    this.selectedAcFilters.clear();
    this.selectedDeckFilters.clear();
    this.selectedTimeFilters.clear();
  }

  get hasActiveFilters(): boolean {
    return (
      this.selectedAcFilters.size > 0 ||
      this.selectedDeckFilters.size > 0 ||
      this.selectedTimeFilters.size > 0
    );
  }

  get activeFilterCount(): number {
    return (
      this.selectedAcFilters.size +
      this.selectedDeckFilters.size +
      this.selectedTimeFilters.size
    );
  }

  toggleAcFilter(value: string): void {
    if (this.selectedAcFilters.has(value)) this.selectedAcFilters.delete(value);
    else this.selectedAcFilters.add(value);
  }

  toggleDeckFilter(value: string): void {
    if (this.selectedDeckFilters.has(value)) this.selectedDeckFilters.delete(value);
    else this.selectedDeckFilters.add(value);
  }

  toggleTimeFilter(value: string): void {
    if (this.selectedTimeFilters.has(value)) this.selectedTimeFilters.delete(value);
    else this.selectedTimeFilters.add(value);
  }

  private classifyTimeCategory(minutes: number): TimeCategory {
    if (minutes >= 240 && minutes < 540) return 'Dawn';       // 04:00–08:59
    if (minutes >= 540 && minutes < 780) return 'Morning';    // 09:00–12:59
    if (minutes >= 780 && minutes < 1080) return 'Afternoon'; // 13:00–17:59
    if (minutes >= 1080 && minutes < 1260) return 'Evening';  // 18:00–20:59
    return 'Night';                                            // 21:00–03:59
  }

  /** Time-of-day category for a vehicle's departure on the selected route. */
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

  getDeckIcon(deck: string | undefined): string {
    const d = (deck ?? '').toLowerCase();
    if (d.includes('sleeper')) return '🛌';
    if (d.includes('double')) return '🏢';
    if (d.includes('upper')) return '🔼';
    if (d.includes('lower')) return '🔽';
    return '🚌';
  }

  /** AC/Non-AC filter options — only values actually present in availableVehicles, with counts. */
  get acFilterOptions(): FilterOption[] {
    const map = new Map<string, number>();
    for (const v of this.availableVehicles) {
      const key = v.acType || 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([value, count]) => ({
        value,
        label: value,
        icon: value === 'AC' ? '❄️' : '🌬️',
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Bus-type (deck level) filter options — only values actually present, with counts. */
  get deckFilterOptions(): FilterOption[] {
    const map = new Map<string, number>();
    for (const v of this.availableVehicles) {
      const key = v.deckLevel || 'Unknown';
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([value, count]) => ({
        value,
        label: value,
        icon: this.getDeckIcon(value),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** Departure-time filter options — only time buckets that actually have a vehicle, in day order. */
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

  /** Final vehicle list shown to the customer — filtered by active filters, already time-sorted from availableVehicles. */
  get filteredVehicles(): Vehicle[] {
    return this.availableVehicles.filter((v) => {
      if (this.selectedAcFilters.size && !this.selectedAcFilters.has(v.acType || 'Unknown')) {
        return false;
      }
      if (this.selectedDeckFilters.size && !this.selectedDeckFilters.has(v.deckLevel || 'Unknown')) {
        return false;
      }
      if (this.selectedTimeFilters.size) {
        const cat = this.getTimeCategoryForVehicle(v.id);
        if (!this.selectedTimeFilters.has(cat)) return false;
      }
      return true;
    });
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

  getVehicleByTripId(tripId: number): Vehicle | null {
    const trip = this.trips.find((t) => t.id === tripId);
    if (!trip) return null;
    const schedule = this.schedules.find((s) => s.id === trip.scheduleId);
    if (!schedule) return null;
    return this.vehicles.find((v) => v.id === schedule.vehicleId) ?? null;
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

    this.availableVehicles = this.vehicles
      .filter(
        (v) =>
          v.type === 'Bus' &&
          this.schedules.some(
            (s) =>
              s.routeId === Number(this.selectedRouteCode) &&
              s.vehicleId === v.id,
          ),
      )
      .sort((a, b) => {
        const schedA = this.schedules.find(
          (s) =>
            s.vehicleId === a.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        const schedB = this.schedules.find(
          (s) =>
            s.vehicleId === b.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        return (
          this.getDepartureMinutes(schedA) - this.getDepartureMinutes(schedB)
        );
      });

    // A new route/date means a new filter context — start clean.
    this.clearAllFilters();

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

  getSelectedRoute(): RouteDto | undefined {
    return this.routes.find((r) => r.id === Number(this.selectedRouteCode));
  }

  getLocationName(locationCode: string | undefined): string {
    if (!locationCode) return '';
    return (
      this.locations.find((l) => l.locationCode === locationCode)?.name ??
      locationCode
    );
  }

  get departureCounters(): TicketCounterDto[] {
    const route = this.getSelectedRoute();
    if (!route) return this.counters;
    const filtered = this.counters.filter(
      (c) => c.locationCode === route.departureLocationCode,
    );
    return filtered.length ? filtered : this.counters;
  }

  get arrivalCounters(): TicketCounterDto[] {
    const route = this.getSelectedRoute();
    if (!route) return this.counters;
    const filtered = this.counters.filter(
      (c) => c.locationCode === route.destinationLocationCode,
    );
    return filtered.length ? filtered : this.counters;
  }

  get departureCountersFallback(): boolean {
    const route = this.getSelectedRoute();
    if (!route || !this.selectedRouteCode) return false;
    return (
      this.counters.filter(
        (c) => c.locationCode === route.departureLocationCode,
      ).length === 0
    );
  }

  get arrivalCountersFallback(): boolean {
    const route = this.getSelectedRoute();
    if (!route || !this.selectedRouteCode) return false;
    return (
      this.counters.filter(
        (c) => c.locationCode === route.destinationLocationCode,
      ).length === 0
    );
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
      this.showToast(
        'error',
        'Please select From and To before booking seats.',
      );
      return;
    }
    if (!this.selectedDepartureDate) {
      this.showToast(
        'error',
        'Please select a departure date before booking seats.',
      );
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
      this.showToast(
        'error',
        'Could not find vehicle or schedule information.',
      );
      return;
    }

    this.seatLayoutMode = this.getLayoutModeForVehicle(vehicle);

    const capacity = vehicle.capacity ?? 40;

    this.liveBookedSeats = [];
    this.activeTripId = null;
    this.selectedSeats = [];
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;

    this.generateSeats(capacity, vehicle);

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
                this.generateSeats(capacity, vehicle);

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
    this.seatLayoutMode = 'two-two';
    this.isDualDeck = false;
    this.lowerDeckSeats = [];
    this.upperDeckSeats = [];
    this.lowerRows = [];
    this.upperRows = [];
  }

  private generateSeats(capacity: number, vehicle?: Vehicle): void {
    const v =
      vehicle ?? this.vehicles.find((x) => x.id === this.seatBookingBusId);
    this.isDualDeck = v ? this.isDualDeckVehicle(v) : false;

    if (!this.isDualDeck) {
      const seats = this._buildDeckSeats(capacity, '', this.liveBookedSeats);
      this.seats = seats;
      this._buildSeatMap(seats, '');
      this.lowerDeckSeats = [];
      this.upperDeckSeats = [];
      this.lowerRows = [];
      this.upperRows = [];
      return;
    }

    const cols = this.totalColsPerRow;
    const totalRows = Math.ceil(capacity / cols);

    const lowerRowCount = Math.max(1, Math.floor(totalRows / 2) - 1);
    const upperRowCount = totalRows - lowerRowCount;

    const lowerCapacity = lowerRowCount * cols;
    const upperCapacity = capacity - lowerCapacity;

    const lowerBooked = this.liveBookedSeats
      .filter((s) => s.startsWith('L-'))
      .map((s) => s.slice(2));
    const upperBooked = this.liveBookedSeats
      .filter((s) => s.startsWith('U-'))
      .map((s) => s.slice(2));

    const lower = this._buildDeckSeats(lowerCapacity, 'L-', lowerBooked);
    const upper = this._buildDeckSeats(upperCapacity, 'U-', upperBooked);

    this.lowerDeckSeats = lower;
    this.upperDeckSeats = upper;

    this.lowerRows = Array.from(
      new Set(lower.map((s) => s.seatNumber.charAt(2))),
    );
    this.upperRows = Array.from(
      new Set(upper.map((s) => s.seatNumber.charAt(2))),
    );

    const all = [...lower, ...upper];
    this.seats = all;
    this.seatMap = {};
    for (const s of all) {
      this.seatMap[s.seatNumber] = s;
    }
    this.rows = [];
  }

  private _buildDeckSeats(
    capacity: number,
    prefix: string,
    booked: string[],
  ): SeatDto[] {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cols = this.totalColsPerRow;
    const seats: SeatDto[] = [];
    let count = 0;

    outer: for (let r = 0; r < alphabet.length; r++) {
      const row = alphabet[r];
      for (let c = 1; c <= cols; c++) {
        if (count >= capacity) break outer;
        count++;
        const bare = `${row}${c}`;
        const seatNum = `${prefix}${bare}`;
        seats.push({
          id: count,
          seatNumber: seatNum,
          seatCode: seatNum,
          isBooked: false,
          status: booked.includes(bare) ? 'reserved' : 'available',
        });
      }
    }

    if (seats.length > 0) {
      const lastRowLetter = seats[seats.length - 1].seatNumber.charAt(
        prefix.length,
      );
      const existingCols = new Set(
        seats
          .filter((s) => s.seatNumber.charAt(prefix.length) === lastRowLetter)
          .map((s) => parseInt(s.seatNumber.slice(prefix.length + 1), 10)),
      );
      let padId = count;
      for (let c = 1; c <= cols; c++) {
        if (!existingCols.has(c)) {
          padId++;
          const bare = `${lastRowLetter}${c}`;
          const seatNum = `${prefix}${bare}`;
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

    return seats;
  }

  private _buildSeatMap(seats: SeatDto[], prefix: string): void {
    seats.sort((a, b) => {
      const ra = a.seatNumber.charAt(prefix.length);
      const rb = b.seatNumber.charAt(prefix.length);
      if (ra !== rb) return ra.charCodeAt(0) - rb.charCodeAt(0);
      return (
        parseInt(a.seatNumber.slice(prefix.length + 1), 10) -
        parseInt(b.seatNumber.slice(prefix.length + 1), 10)
      );
    });
    this.rows = Array.from(
      new Set(seats.map((s) => s.seatNumber.charAt(prefix.length))),
    );
    this.seatMap = {};
    for (const s of seats) {
      this.seatMap[s.seatNumber] = s;
    }
  }

  getSeatByPosition(
    row: string,
    col: number,
    prefix = '',
  ): SeatDto | undefined {
    return this.seatMap[`${prefix}${row}${col}`];
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

  /** Prefills the passenger name from the logged-in user for customer bookings. */
  private prefillPassengerNameIfCustomer(): void {
    if (this.isAdmin) return;
    const name = getUserName();
    if (name) {
      this.selectedTicket.passengerName = name;
    }
  }

  continueToTicketDetails(vehicleCode: string, vehicleId: number): void {
    if (!this.selectedSeats.length) {
      return;
    }

    // Close the seat drawer first
    this.openSeatPanel(vehicleCode, vehicleId);

    // Wait for Angular to remove the drawer, then scroll
    setTimeout(() => {
      const ticketDetails = document.getElementById('ticketDetailsSection');

      if (ticketDetails) {
        ticketDetails.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    }, 50);
  }

  save(): void {
    const fail = (msg: string) => {
      this.showToast('error', msg);
    };

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
      return fail('Please select From, To and a valid vehicle.');
    }

    if (this.selectedTicket.id) {
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
              departureCounterId: Number(
                this.selectedTicket.departureCounterId,
              ),
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
                this.showToast(
                  'error',
                  'Failed to update ticket. Please try again.',
                );
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed during update', e);
            this.showToast(
              'error',
              'Could not resolve trip. Check schedule/date.',
            );
          },
        });
    } else {
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
                this.loadTrips();
                this.showToast('success', 'Ticket saved successfully!');
                this.reset();
              },
              error: (e) => {
                console.error('Create ticket failed', e);
                this.showToast(
                  'error',
                  'Failed to save ticket. Please try again.',
                );
              },
            });
          },
          error: (e) => {
            console.error('Trip resolution failed', e);
            this.showToast(
              'error',
              'Could not resolve trip. Check schedule/date.',
            );
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
    this.prefillPassengerNameIfCustomer();
    this.selectedRouteCode = '';
    this.selectedFromLocation = '';
    this.selectedToLocation = '';
    this.fromLocationSearch = '';   // ← added
    this.toLocationSearch = '';     // ← added
    this.selectedVehicleCode = '';
    this.selectedTicket.departureCounterId = 0;
    this.selectedTicket.arrivalCounterId = 0;
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.clearAllFilters();
    this.closeSeatPanel();
  }

  openModal(ticket: TicketDto): void {
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

        this.selectedBaseFare = schedule.baseFare;
      }
    }

    if (ticket.bookingDateTime) {
      this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(
        0,
        10,
      );
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

    this.availableVehicles = this.vehicles
      .filter(
        (v) =>
          v.type === 'Bus' &&
          this.schedules.some(
            (s) =>
              s.routeId === Number(this.selectedRouteCode) &&
              s.vehicleId === v.id,
          ),
      )
      .sort((a, b) => {
        const schedA = this.schedules.find(
          (s) =>
            s.vehicleId === a.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        const schedB = this.schedules.find(
          (s) =>
            s.vehicleId === b.id &&
            s.routeId === Number(this.selectedRouteCode),
        );
        return (
          this.getDepartureMinutes(schedA) - this.getDepartureMinutes(schedB)
        );
      });

    // Clear filters when the edit-modal vehicle list is (re)populated.
    this.clearAllFilters();

    this.refreshAvailableSeatCounts();
  }

  closeModal(): void {
    this.showModal = false;
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.clearAllFilters();
    this.closeSeatPanel();
    this.selectedTicket = this.emptyTicket();
    this.prefillPassengerNameIfCustomer();
    this.selectedRouteCode = '';
    this.selectedFromLocation = '';
    this.selectedToLocation = '';
    this.fromLocationSearch = '';   // ← added
    this.toLocationSearch = '';     // ← added
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
  }

  // ── Sorting / pagination ──────────────────────────────────────────────────────

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

  // ── Utilities ─────────────────────────────────────────────────────────────────

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  // ── Search ────────────────────────────────────────────────────────────────────
  passengerSearch: string = '';

  get filteredTickets(): TicketDto[] {
    const q = this.passengerSearch.trim().toLowerCase();
    if (!q) return this.tickets;
    return this.tickets.filter((t) =>
      t.passengerName?.toLowerCase().includes(q),
    );
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.updatePagination();
  }

  // ── Toast system ──────────────────────────────────────────────────────────────

  toasts: {
    id: number;
    type: 'success' | 'error' | 'warn' | 'info';
    message: string;
  }[] = [];
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
    this.currentPage = 1;
    this.updatePagination();
  }
}