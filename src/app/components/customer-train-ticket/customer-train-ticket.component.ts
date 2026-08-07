// customer-train-ticket.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { isNonNull } from '../../utils/type-guards'; // adjust relative path per file
import {
  TicketDto,
  CreateTicketDto,
  RouteDto,
  Vehicle,
  OperatorDto,
  ScheduleDto,
  SeatDto,
  LocationDto,
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { TicketService } from '../../services/ticket.service';
import { TripService } from '../../services/trip.service';
import { LocationService } from '../../services/location.service';
import { SeatLockService } from '../../services/seat-lock.service';
// NOTE: getUserName must exist in auth.utils (added alongside getUserRole).
import { getUserName } from '../../utils/auth.utils';
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
  selector: 'app-customer-train-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './customer-train-ticket.component.html',
  styleUrls: ['./customer-train-ticket.component.css'],
})
export class CustomerTrainTicketComponent implements OnInit, OnDestroy {
  // ── Data lists ───────────────────────────────────────────────────────────────
  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  availableVehicles: Vehicle[] = [];
  locations: LocationDto[] = [];

  // ── Form state ───────────────────────────────────────────────────────────────
  selectedTicket: TrainTicketDto = this.emptyTicket();
  selectedRouteCode: string = '';

  // ← NEW: From / To location filters that drive route selection.
  selectedFromLocation: string = '';
  selectedToLocation: string = '';

  selectedVehicleCode: string = '';
  selectedDepartureDate: string = '';
  selectedArrivalDate: string = '';
  todayString: string = '';
  selectedBaseFare: number = 0;

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

  // ── SignalR subscriptions ─────────────────────────────────────────────────────
  private signalrSubs: Subscription[] = [];

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

    // ← NEW: prefill passenger name from the logged-in customer.
    const name = getUserName();
    if (name) this.selectedTicket.passengerName = name;

    this.loadAll();

    try {
      await this.seatLockService.startConnection(
        'https://localhost:7139/hubs/seats',
      );
      this._wireSignalREvents();
    } catch {
      console.warn(
        '[CustomerTrainTicket] SignalR unavailable; real-time seat locking disabled.',
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
    this.locationService.getAllLocations().subscribe({
      next: (d) => (this.locations = d),
      error: (e) => console.error(e),
    });

    forkJoin({
      vehicles: this.vehicleService.getAll(),
    }).subscribe({
      next: ({ vehicles }) => {
        this.vehicles = vehicles;
      },
      error: (e) => console.error(e),
    });
  }

  // ── From / To (route picker) ─────────────────────────────────────────────────

  /** All unique locations that are a valid departure ("From") point on some route. */
  get fromLocations(): LocationDto[] {
    const codes = new Set(this.routes.map((r) => r.departureLocationCode));
    return this.locations.filter((l) => isNonNull(l.locationCode) && codes.has(l.locationCode));
  }

  /** Locations reachable ("To") from the currently selected From location. */
  get toLocations(): LocationDto[] {
    if (!this.selectedFromLocation) return [];
    const codes = new Set(
      this.routes
        .filter((r) => r.departureLocationCode === this.selectedFromLocation)
        .map((r) => r.destinationLocationCode),
    );
    return this.locations.filter((l) => isNonNull(l.locationCode) && codes.has(l.locationCode));
  }

  onFromLocationChange(): void {
    this.selectedToLocation = '';
    this.selectedRouteCode = '';
    this.availableVehicles = [];
    this.availableSeatCounts = {};
    this.selectedArrivalDate = '';
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
    this.vehicleClassConfigs = {};
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
              this.liveBookedSeats = booked;

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
          '[CustomerTrainTicket] Snapshot timeout — proceeding without locked seats.',
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

    this.closeSeatPanel();
    this.selectedTicket.seatNumber = '';
    this.selectedTicket.trainClass = '';
    this.selectedTicket.farePaid = 0;
    this.selectedVehicleCode = '';
    this.selectedBaseFare = 0;
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

  getLocationName(locationCode: string | undefined): string {
    if (!locationCode) return '';
    return (
      this.locations.find((l) => l.locationCode === locationCode)?.name ??
      locationCode
    );
  }

  getOperatorName(operatorCode: string | undefined): string {
    if (!operatorCode) return '';
    return (
      this.operators.find((o) => o.operatorCode === operatorCode)?.name ?? ''
    );
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
  // SAVE
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
    return fail('Please select From, To and a valid train.');

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
          bookingCounterId: 0,
          departureCounterId: 0,
          arrivalCounterId: 0,
        };
        this.ticketService.createTicket(dto).subscribe({
          next: async () => {
            // Broadcast the real booking state BEFORE any local cleanup runs.
            // Without this, reset() → clearSelection() would call releaseSeat()
            // on these exact seats, broadcasting SeatReleased and making them
            // look free to every other customer/agent until they happen to
            // refetch bookedSeats from the database (i.e. on next page load).
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

            this.showToast('success', 'Train ticket booked successfully!');
            await this.reset(false);
          },
          error: (e) => {
            console.error(e);
            this.showToast('error', 'Failed to book ticket. Please try again.');
          },
        });
      },
      error: (e) => {
        console.error(e);
        this.showToast('error', 'Could not resolve trip.');
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
