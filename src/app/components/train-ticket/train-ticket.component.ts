// train-ticket.component.ts
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

// ─────────────────────────────────────────────────────────────────────────────
// TRAIN CLASS TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The four standard classes offered on Bangladeshi intercity trains.
 *
 * AC_BERTH   – Air-conditioned sleeping berths (most premium, ~6 berths per compartment)
 * SNIGDHA    – Air-conditioned chair car         (4 seats per row, ~40 seats/bogie)
 * SHOVON     – Non-AC chair car                  (4 seats per row, ~44 seats/bogie)
 * REGULAR    – Non-AC ordinary                   (4 seats per row, ~60 seats/bogie)
 */
export type TrainClassType = 'AC Berth' | 'Snigdha' | 'Shovon' | 'Regular';

/** Berth position within a 6-berth compartment */
export type BerthPosition = 'Lower' | 'Middle' | 'Upper' | 'Side Lower' | 'Side Upper';

/** Per-class configuration stored on the vehicle */
export interface TrainClassConfig {
  classType: TrainClassType;
  /** Number of bogies for this class */
  bogieCount: number;
  /** Seats/berths per bogie */
  capacityPerBogie: number;
  /** Base fare for this class */
  fare: number;
  /** Available seats (computed at runtime) */
  availableSeats: number;
}

/** One berth seat within a compartment */
export interface TrainSeatDto extends SeatDto {
  classType: TrainClassType;
  bogieIndex: number;
  /** Compartment number within the bogie (berth classes only) */
  compartmentIndex?: number;
  berthPosition?: BerthPosition;
}

/** One berth compartment (6 berths per compartment) */
export interface BerthCompartment {
  compartmentName: string;
  seats: TrainSeatDto[];
  availableCount: number;
  totalCount: number;
}

/** One bogie (carriage) */
export interface TrainBogie {
  bogieName: string;
  classType: TrainClassType;
  bogieIndex: number;
  seats: TrainSeatDto[];
  compartments: BerthCompartment[];  // populated for berth classes only
  availableCount: number;
}

/** Extended ticket DTO with train-specific fields */
export interface TrainTicketDto extends TicketDto {
  trainClass?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLASS CONFIG DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/** Default class configurations derived from vehicle properties at runtime */
const DEFAULT_CLASS_CONFIGS: Record<TrainClassType, Omit<TrainClassConfig, 'fare' | 'availableSeats'>> = {
  'AC Berth': { classType: 'AC Berth', bogieCount: 3, capacityPerBogie: 42 },   // 7 compartments × 6 berths
  'Snigdha':  { classType: 'Snigdha',  bogieCount: 2, capacityPerBogie: 40 },   // 10 rows × 4 seats
  'Shovon':   { classType: 'Shovon',   bogieCount: 3, capacityPerBogie: 44 },   // 11 rows × 4 seats
  'Regular':  { classType: 'Regular',  bogieCount: 2, capacityPerBogie: 60 },   // 15 rows × 4 seats
};

const BERTHS_PER_COMPARTMENT = 6;
const BERTH_POSITIONS: BerthPosition[] = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Lower'];

@Component({
  selector: 'app-train-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './train-ticket.component.html',
  styleUrls: ['./train-ticket.component.css'],
})
export class TrainTicketComponent implements OnInit {

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

  // ── Selected / form state ────────────────────────────────────────────────────
  selectedTicket: TrainTicketDto = this.emptyTicket();
  selectedRouteCode: string = '';
  selectedVehicleCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

  // ── UI state ─────────────────────────────────────────────────────────────────
  showModal = false;
  showCancelConfirmModal = false;
  ticketToCancel: TrainTicketDto | null = null;
  cancelReason: string = 'Counter request';

  // ── Pagination / sort ────────────────────────────────────────────────────────
  currentPage = 1;
  itemsPerPage = 25;
  totalPages = 1;
  pages: number[] = [];
  sortField: string = '';
  sortAsc: boolean = true;

  // ── Seat panel state ─────────────────────────────────────────────────────────
  seatBookingBusId: number | null = null;
  seatPanelLoading = false;
  selectedSeats: TrainSeatDto[] = [];

  /** Active class tab in the seat panel */
  activeClassTab: TrainClassType | '' = '';

  /**
   * Per-vehicle train class configurations.
   * Key: vehicleId, Value: array of TrainClassConfig
   * These are built dynamically when a vehicle's seat panel is opened.
   */
  private vehicleClassConfigs: Record<number, TrainClassConfig[]> = {};

  /** Classes for the currently open vehicle */
  trainClasses: TrainClassConfig[] = [];

  /** All bogies for the currently open vehicle, keyed by class */
  private bogiesByClass: Record<string, TrainBogie[]> = {};

  /** Master seat map: seatNumber → seat */
  private seatMap: Record<string, TrainSeatDto> = {};

  /** Live booked seat numbers for the active trip */
  private liveBookedSeats: string[] = [];

  /** tripId for the currently open seat panel */
  private activeTripId: number | null = null;

  /** Available seat counts per vehicleId */
  private availableSeatCounts: Record<number, number> = {};

  /** For edit mode: original seat numbers */
  private editingOriginalSeats: string[] = [];
  private editingOriginalVehicleId: number | null = null;
  private editSeatsPreSelected = false;

  // ── Search ────────────────────────────────────────────────────────────────────
  passengerSearch: string = '';

  // ── Toast ─────────────────────────────────────────────────────────────────────
  toasts: { id: number; type: 'success' | 'error' | 'warn' | 'info'; message: string }[] = [];
  private _toastId = 0;

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
    this.loadAll();
  }

  private loadAll(): void {
    this.routeService.getAllRoutes().subscribe({ next: d => this.routes = d, error: e => console.error(e) });
    this.vehicleService.getAll().subscribe({ next: d => this.vehicles = d, error: e => console.error(e) });
    this.operatorService.getAll().subscribe({ next: d => this.operators = d, error: e => console.error(e) });
    this.scheduleService.getAllSchedules().subscribe({ next: d => this.schedules = d, error: e => console.error(e) });
    this.ticketCounterService.getAllTicketCounters().subscribe({ next: d => this.counters = d, error: e => console.error(e) });
    this.tripService.getAll().subscribe({ next: d => this.trips = d, error: e => console.error(e) });
    this.locationService.getAllLocations().subscribe({ next: d => this.locations = d, error: e => console.error(e) });
    this.loadTickets();
  }

  loadTickets(): void {
    this.ticketService.getTickets().subscribe({
      next: d => { this.tickets = d as TrainTicketDto[]; this.updatePagination(); },
      error: e => console.error(e),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TRAIN CLASS HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns all train classes configured for a vehicle.
   * We derive configs from the vehicle's capacity and type.
   * In a real app you'd have a dedicated API that returns the class breakdown.
   */
  getTrainClasses(vehicle: Vehicle): TrainClassConfig[] {
    if (this.vehicleClassConfigs[vehicle.id]) return this.vehicleClassConfigs[vehicle.id];

    const schedule = this.schedules.find(
      s => s.vehicleId === vehicle.id && s.routeId === Number(this.selectedRouteCode)
    );
    const baseFare = schedule?.baseFare ?? 300;

    // Build fare tiers based on base fare
    const configs: TrainClassConfig[] = [
      { classType: 'AC Berth', bogieCount: 3, capacityPerBogie: 42, fare: Math.round(baseFare * 3.5), availableSeats: 0 },
      { classType: 'Snigdha',  bogieCount: 2, capacityPerBogie: 40, fare: Math.round(baseFare * 2.5), availableSeats: 0 },
      { classType: 'Shovon',   bogieCount: 3, capacityPerBogie: 44, fare: Math.round(baseFare * 1.2), availableSeats: 0 },
      { classType: 'Regular',  bogieCount: 2, capacityPerBogie: 60, fare: baseFare,                   availableSeats: 0 },
    ];

    // Compute total capacity
    configs.forEach(cfg => {
      cfg.availableSeats = cfg.bogieCount * cfg.capacityPerBogie;
    });

    this.vehicleClassConfigs[vehicle.id] = configs;
    return configs;
  }

  /** Returns the min fare across all classes for a vehicle */
  getMinFareForVehicle(vehicleId: number): number {
    const v = this.vehicles.find(v => v.id === vehicleId);
    if (!v) return 0;
    const classes = this.getTrainClasses(v);
    return Math.min(...classes.map(c => c.fare));
  }

  /** Total available seats across all classes for a vehicle */
  getTotalAvailableSeats(vehicleId: number): number {
    if (vehicleId in this.availableSeatCounts) return this.availableSeatCounts[vehicleId];
    const v = this.vehicles.find(v => v.id === vehicleId);
    if (!v) return 0;
    return this.getTrainClasses(v).reduce((sum, c) => sum + c.capacityPerBogie * c.bogieCount, 0);
  }

  isBerthClass(classType: string): boolean {
    return classType === 'AC Berth';
  }

  getClassIcon(classType: string): string {
    const icons: Record<string, string> = {
      'AC Berth': '🛏️',
      'Snigdha':  '❄️',
      'Shovon':   '💺',
      'Regular':  '🪑',
    };
    return icons[classType] ?? '💺';
  }

  getClassTagCss(classType: string): string {
    const map: Record<string, string> = {
      'AC Berth': 'cls-ac-berth',
      'Snigdha':  'cls-snigdha',
      'Shovon':   'cls-shovon',
      'Regular':  'cls-regular',
    };
    return map[classType] ?? '';
  }

  getClassTabCss(classType: string): string {
    return 'class-tab--' + classType.toLowerCase().replace(' ', '-');
  }

  getBerthPositionIcon(pos: string | undefined): string {
    const icons: Record<string, string> = {
      'Lower':      '⬇️',
      'Middle':     '↔️',
      'Upper':      '⬆️',
      'Side Lower': '◀️',
      'Side Upper': '🔼',
    };
    return pos ? (icons[pos] ?? '🛏️') : '🛏️';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEAT PANEL
  // ─────────────────────────────────────────────────────────────────────────────

  openSeatPanel(vehicleCode: string, vehicleId: number): void {
    if (this.seatBookingBusId === vehicleId) {
      this.closeSeatPanel();
      return;
    }

    if (!this.selectedRouteCode) { this.showToast('error', 'Please select a route first.'); return; }
    if (!this.selectedDepartureDate) { this.showToast('error', 'Please select a departure date first.'); return; }

    this.selectedVehicleCode = vehicleCode;
    this.seatBookingBusId = vehicleId;
    this.seatPanelLoading = true;
    this.selectedSeats = [];
    this.seatMap = {};
    this.bogiesByClass = {};
    this.activeClassTab = '';

    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    const schedule = this.schedules.find(
      s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode)
    );

    if (!vehicle || !schedule) {
      this.showToast('error', 'Could not find vehicle or schedule information.');
      this.seatPanelLoading = false;
      return;
    }

    this.trainClasses = this.getTrainClasses(vehicle);

    // Set base fare from first class shown
    this.selectedBaseFare = this.trainClasses[0]?.fare ?? 0;

    this.tripService.findOrCreate({ scheduleId: schedule.id, tripDate: this.selectedDepartureDate }).subscribe({
      next: trip => {
        this.activeTripId = trip.id;
        this.tripService.getBookedSeats(trip.id).subscribe({
          next: booked => {
            this.liveBookedSeats = this.showModal
              ? booked.filter(s => !this.editingOriginalSeats.includes(s))
              : booked;

            // Build all bogies for all classes
            this.buildAllBogies(vehicle);

            // Update available seat counts per class
            this.trainClasses.forEach(cfg => {
              const bogies = this.bogiesByClass[cfg.classType] ?? [];
              cfg.availableSeats = bogies.reduce((sum, b) => sum + b.availableCount, 0);
            });

            const totalAvail = this.trainClasses.reduce((s, c) => s + c.availableSeats, 0);
            this.availableSeatCounts[vehicleId] = totalAvail;

            // Default to first class that has available seats
            const firstAvail = this.trainClasses.find(c => c.availableSeats > 0);
            this.activeClassTab = firstAvail?.classType ?? this.trainClasses[0]?.classType ?? '';
            if (this.activeClassTab) this.selectedBaseFare = this.trainClasses.find(c => c.classType === this.activeClassTab)?.fare ?? 0;

            // Restore selections in edit mode
            if (this.showModal && !this.editSeatsPreSelected && this.editingOriginalVehicleId === vehicleId) {
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
          error: e => { console.error(e); this.seatPanelLoading = false; },
        });
      },
      error: e => { console.error(e); this.seatPanelLoading = false; },
    });
  }

  setActiveClassTab(classType: TrainClassType): void {
    this.activeClassTab = classType;
    const cfg = this.trainClasses.find(c => c.classType === classType);
    if (cfg) this.selectedBaseFare = cfg.fare;
  }

  getActiveBogies(): TrainBogie[] {
    return this.bogiesByClass[this.activeClassTab] ?? [];
  }

  isCompartmentSelected(comp: BerthCompartment): boolean {
    return comp.seats.some(s => s.status === 'selected');
  }

  private closeSeatPanel(): void {
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
        const bogieName = `${cfg.classType} Bogie ${bi + 1}`;
        const bogie: TrainBogie = {
          bogieName,
          classType: cfg.classType,
          bogieIndex: bi,
          seats: [],
          compartments: [],
          availableCount: 0,
        };

        if (this.isBerthClass(cfg.classType)) {
          // ── Berth layout ──────────────────────────────────────────────────
          const compartmentCount = Math.floor(cfg.capacityPerBogie / BERTHS_PER_COMPARTMENT);
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
              if (!isBooked) { comp.availableCount++; bogie.availableCount++; }
              globalSeatNum++;
            }
            bogie.compartments.push(comp);
          }
        } else {
          // ── Chair layout ──────────────────────────────────────────────────
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const rowCount = Math.ceil(cfg.capacityPerBogie / 4);
          let seatInBogie = 0;
          for (let ri = 0; ri < rowCount && seatInBogie < cfg.capacityPerBogie; ri++) {
            for (let col = 1; col <= 4 && seatInBogie < cfg.capacityPerBogie; col++) {
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

  /** Get unique row letters for a chair bogie */
  getBogieSeatRows(bogie: TrainBogie): string[] {
    const prefix = `${bogie.classType.charAt(0)}${bogie.bogieIndex + 1}-`;
    const rows = new Set<string>();
    for (const seat of bogie.seats) {
      const bare = seat.seatNumber.replace(prefix, '');
      rows.add(bare.charAt(0));
    }
    return Array.from(rows);
  }

  /** Look up a seat by bogie + row letter + col number */
  getSeatByBogiePosition(bogie: TrainBogie, row: string, col: number): TrainSeatDto | undefined {
    const key = `${bogie.classType.charAt(0)}${bogie.bogieIndex + 1}-${row}${col}`;
    return this.seatMap[key];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TOGGLE SEAT
  // ─────────────────────────────────────────────────────────────────────────────

  toggleSeat(seat: TrainSeatDto): void {
    if (!seat || seat.status === 'reserved') return;
    const mapSeat = this.seatMap[seat.seatNumber];
    if (!mapSeat) return;

    if (this.showModal && this.editSeatsPreSelected && this.editingOriginalSeats.length > 0) {
      this.editingOriginalSeats = [];
    }

    if (mapSeat.status === 'selected') {
      mapSeat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(s => s.seatNumber !== seat.seatNumber);
    } else {
      if (this.selectedSeats.length >= 6) {
        this.showToast('warn', 'Maximum 6 seats can be booked per ticket.');
        return;
      }
      // All seats in one ticket must be the same class
      if (this.selectedSeats.length > 0 && this.selectedSeats[0].classType !== mapSeat.classType) {
        this.showToast('warn', 'All seats must be from the same class in one ticket.');
        return;
      }
      mapSeat.status = 'selected';
      this.selectedSeats = [...this.selectedSeats, mapSeat];
    }

    // Set class tab to match selection
    if (this.selectedSeats.length > 0) {
      this.activeClassTab = this.selectedSeats[0].classType;
      const cfg = this.trainClasses.find(c => c.classType === this.activeClassTab);
      if (cfg) this.selectedBaseFare = cfg.fare;
    }

    this.updateSeatNumberField();
  }

  clearSelection(): void {
    this.selectedSeats.forEach(s => { if (s.status !== 'reserved') s.status = 'available'; });
    this.selectedSeats = [];
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.trainClass = '';
    this.selectedTicket.farePaid = 0;
    if (this.showModal) this.editingOriginalSeats = [];
  }

  private updateSeatNumberField(): void {
    this.selectedTicket.seatNumber = this.selectedSeats.map(s => s.seatNumber).sort().join(', ');
    this.selectedTicket.trainClass = this.selectedSeats[0]?.classType ?? '';
    this.selectedTicket.farePaid = this.selectedBaseFare * this.selectedSeats.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ROUTE & DATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  calculateArrivalDate(): void {
    if (!this.selectedDepartureDate || !this.selectedRouteCode) return;
    const route = this.routes.find(r => r.id === Number(this.selectedRouteCode));
    if (!route?.estimatedDurationHours) return;

    const dep = new Date(this.selectedDepartureDate);
    const arr = new Date(dep.getTime() + route.estimatedDurationHours * 3_600_000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.selectedArrivalDate = `${arr.getFullYear()}-${pad(arr.getMonth() + 1)}-${pad(arr.getDate())}`;
    this.selectedTicket.bookingDateTime = this.selectedDepartureDate;

    this.availableVehicles = this.vehicles
      .filter(v => v.type === 'Train' && this.schedules.some(
        s => s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id
      ))
      .sort((a, b) => {
        const sA = this.schedules.find(s => s.vehicleId === a.id && s.routeId === Number(this.selectedRouteCode));
        const sB = this.schedules.find(s => s.vehicleId === b.id && s.routeId === Number(this.selectedRouteCode));
        return this.getDepartureMinutes(sA) - this.getDepartureMinutes(sB);
      });

    // Reset on date/route change
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
      this.availableSeatCounts[vehicle.id] = classes.reduce((sum, c) => sum + c.bogieCount * c.capacityPerBogie, 0);
    }
  }

  getDepartureTimeForVehicle(vehicleId: number): string {
    const s = this.schedules.find(s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode));
    return s ? new Date(s.departureDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  getArrivalTimeForVehicle(vehicleId: number): string {
    const s = this.schedules.find(s => s.vehicleId === vehicleId && s.routeId === Number(this.selectedRouteCode));
    return s ? new Date(s.arrivalDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  }

  getSeatClass(vehicleId: number): string {
    const n = this.getTotalAvailableSeats(vehicleId);
    if (n === 0) return 'full';
    if (n < 20) return 'low';
    return 'high';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // COUNTER / LOCATION HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  getSelectedRoute(): RouteDto | undefined {
    return this.routes.find(r => r.id === Number(this.selectedRouteCode));
  }

  getLocationName(locationCode: string | undefined): string {
    if (!locationCode) return '';
    return this.locations.find(l => l.locationCode === locationCode)?.name ?? locationCode;
  }

  get departureCounters(): TicketCounterDto[] {
    const route = this.getSelectedRoute();
    if (!route) return this.counters;
    const f = this.counters.filter(c => c.locationCode === route.departureLocationCode);
    return f.length ? f : this.counters;
  }

  get arrivalCounters(): TicketCounterDto[] {
    const route = this.getSelectedRoute();
    if (!route) return this.counters;
    const f = this.counters.filter(c => c.locationCode === route.destinationLocationCode);
    return f.length ? f : this.counters;
  }

  get departureCountersFallback(): boolean {
    const route = this.getSelectedRoute();
    if (!route || !this.selectedRouteCode) return false;
    return this.counters.filter(c => c.locationCode === route.departureLocationCode).length === 0;
  }

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    return this.operators.find(o => o.operatorCode === operatorCode)?.name ?? '';
  }

  getCounterName(id: number | string | undefined): string {
    if (id === undefined || id === null) return '—';
    return this.counters.find(c => c.id === Number(id))?.counterName ?? '—';
  }

  getRouteNameByTripId(tripId: number): string {
    const trip = this.trips.find(t => t.id === tripId);
    if (!trip) return '—';
    const schedule = this.schedules.find(s => s.id === trip.scheduleId);
    if (!schedule) return '—';
    return this.routes.find(r => r.id === schedule.routeId)?.routeName ?? '—';
  }

  getOperatorNameByTripId(tripId: number): string {
    const trip = this.trips.find(t => t.id === tripId);
    if (!trip) return '—';
    const schedule = this.schedules.find(s => s.id === trip.scheduleId);
    if (!schedule) return '—';
    const vehicle = this.vehicles.find(v => v.id === schedule.vehicleId);
    if (!vehicle) return '—';
    return this.operators.find(o => o.operatorCode === vehicle.operatorCode)?.name ?? '—';
  }

  getVehicleModelByTripId(tripId: number): string {
    const trip = this.trips.find(t => t.id === tripId);
    if (!trip) return '';
    const schedule = this.schedules.find(s => s.id === trip.scheduleId);
    if (!schedule) return '';
    return this.vehicles.find(v => v.id === schedule.vehicleId)?.model ?? '';
  }

  openDatePicker(event: FocusEvent): void {
    const input = event.target as HTMLInputElement;
    if (typeof input?.showPicker === 'function') input.showPicker();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SAVE / UPDATE
  // ─────────────────────────────────────────────────────────────────────────────

  save(): void {
    const fail = (msg: string) => this.showToast('error', msg);

    if (!this.selectedTicket.passengerName?.trim()) return fail('Please provide Passenger Name.');
    if (!this.selectedTicket.passengerContact?.trim()) return fail('Please provide Passenger Contact.');
    if (!this.selectedTicket.seatNumber?.trim()) return fail('Please select at least one seat.');
    if (!this.selectedTicket.bookingCounterId) return fail('Please select Booking Counter.');
    if (!this.selectedTicket.departureCounterId) return fail('Please select Departure Counter.');
    if (!this.selectedTicket.arrivalCounterId) return fail('Please select Arrival Counter.');

    const vehicleId = this.vehicles.find(v => v.vehicleCode === this.selectedVehicleCode)?.id;
    const schedule = this.schedules.find(
      s => s.routeId === Number(this.selectedRouteCode) && s.vehicleId === vehicleId
    );
    if (!schedule) return fail('Please select a valid train/route combination.');

    if (this.selectedTicket.id) {
      // UPDATE
      this.tripService.findOrCreate({ scheduleId: schedule.id, tripDate: this.selectedDepartureDate }).subscribe({
        next: trip => {
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
              this.editingOriginalSeats = [];
              this.editSeatsPreSelected = false;
              this.editingOriginalVehicleId = null;
              this.showToast('success', 'Train ticket updated successfully!');
              setTimeout(() => this.closeModal(), 1500);
            },
            error: e => { console.error(e); this.showToast('error', 'Failed to update ticket.'); },
          });
        },
        error: e => { console.error(e); this.showToast('error', 'Could not resolve trip.'); },
      });
    } else {
      // CREATE
      this.tripService.findOrCreate({ scheduleId: schedule.id, tripDate: this.selectedDepartureDate }).subscribe({
        next: trip => {
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
            next: () => { this.loadTickets(); this.showToast('success', 'Train ticket saved successfully!'); this.reset(); },
            error: e => { console.error(e); this.showToast('error', 'Failed to save ticket.'); },
          });
        },
        error: e => { console.error(e); this.showToast('error', 'Could not resolve trip.'); },
      });
    }
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
    const dto: CancelTicketDto = { id: this.ticketToCancel.id, reason: this.cancelReason };
    this.ticketService.cancelTicket(dto).subscribe({
      next: () => { this.loadTickets(); this.cancelCancelAction(); this.showToast('success', 'Ticket cancelled successfully.'); },
      error: e => { console.error(e); this.cancelCancelAction(); this.showToast('error', 'Failed to cancel ticket.'); },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  emptyTicket(): TrainTicketDto {
    return {
      id: 0, tripId: 0, ticketCode: '',
      passengerName: '', passengerContact: '', seatNumber: '',
      farePaid: 0, bookingDateTime: this.getTodayDateString(),
      bookingCounterId: 0, departureCounterId: 0, arrivalCounterId: 0,
      status: 'Booked', createdAt: '', createdBy: '',
      trainClass: '',
    };
  }

  reset(): void {
    this.clearSelection();
    this.selectedTicket = this.emptyTicket();
    this.selectedRouteCode = '';
    this.selectedVehicleCode = '';
    this.selectedDepartureDate = '';
    this.selectedArrivalDate = '';
    this.selectedBaseFare = 0;
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.vehicleClassConfigs = {};
    this.editingOriginalSeats = [];
    this.editingOriginalVehicleId = null;
    this.editSeatsPreSelected = false;
    this.closeSeatPanel();
  }

  openModal(ticket: TrainTicketDto): void {
    this.selectedTicket = { ...ticket };
    this.editingOriginalSeats = ticket.seatNumber
      ? ticket.seatNumber.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    this.editSeatsPreSelected = false;

    const trip = this.trips.find(t => t.id === ticket.tripId);
    if (trip) {
      const schedule = this.schedules.find(s => s.id === trip.scheduleId);
      if (schedule) {
        this.selectedRouteCode = String(schedule.routeId);
        const vehicle = this.vehicles.find(v => v.id === schedule.vehicleId);
        if (vehicle) { this.selectedVehicleCode = vehicle.vehicleCode; this.editingOriginalVehicleId = vehicle.id; }
        const tripDate = new Date(trip.tripDate);
        const pad = (n: number) => n.toString().padStart(2, '0');
        this.selectedDepartureDate = `${tripDate.getFullYear()}-${pad(tripDate.getMonth() + 1)}-${pad(tripDate.getDate())}`;
        this._populateVehiclesAndArrivalDate();
      }
    }
    if (ticket.bookingDateTime) this.selectedTicket.bookingDateTime = ticket.bookingDateTime.substring(0, 10);
    this.showModal = true;
  }

  private _populateVehiclesAndArrivalDate(): void {
    if (!this.selectedDepartureDate || !this.selectedRouteCode) return;
    const route = this.routes.find(r => r.id === Number(this.selectedRouteCode));
    if (!route?.estimatedDurationHours) return;
    const dep = new Date(this.selectedDepartureDate);
    const arr = new Date(dep.getTime() + route.estimatedDurationHours * 3_600_000);
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.selectedArrivalDate = `${arr.getFullYear()}-${pad(arr.getMonth() + 1)}-${pad(arr.getDate())}`;
    this.availableVehicles = this.vehicles
      .filter(v => v.type === 'Train' && this.schedules.some(
        s => s.routeId === Number(this.selectedRouteCode) && s.vehicleId === v.id
      ))
      .sort((a, b) => {
        const sA = this.schedules.find(s => s.vehicleId === a.id && s.routeId === Number(this.selectedRouteCode));
        const sB = this.schedules.find(s => s.vehicleId === b.id && s.routeId === Number(this.selectedRouteCode));
        return this.getDepartureMinutes(sA) - this.getDepartureMinutes(sB);
      });
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
    this.vehicleClassConfigs = {};
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAGINATION / SORT / SEARCH
  // ─────────────────────────────────────────────────────────────────────────────

  get filteredTickets(): TrainTicketDto[] {
    const q = this.passengerSearch.trim().toLowerCase();
    return q ? this.tickets.filter(t => t.passengerName?.toLowerCase().includes(q)) : this.tickets;
  }

  onSearchChange(): void { this.currentPage = 1; this.updatePagination(); }

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

  goToPreviousPage(): void { this.goToPage(this.currentPage - 1); }
  goToNextPage(): void { this.goToPage(this.currentPage + 1); }

  sortBy(field: string): void {
    if (this.sortField === field) { this.sortAsc = !this.sortAsc; } else { this.sortField = field; this.sortAsc = true; }
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

  showToast(type: 'success' | 'error' | 'warn' | 'info', message: string, durationMs = 2500): void {
    const id = ++this._toastId;
    this.toasts.push({ id, type, message });
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  dismissToast(id: number): void { this.toasts = this.toasts.filter(t => t.id !== id); }
  trackToast(_: number, toast: { id: number }): number { return toast.id; }

  private getTodayDateString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }
}