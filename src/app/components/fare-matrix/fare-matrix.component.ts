import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Subject, EMPTY } from 'rxjs';
import {
  debounceTime,
  groupBy,
  mergeMap,
  switchMap,
  catchError,
} from 'rxjs/operators';
import {
  RouteDto,
  Vehicle,
  OperatorDto,
  ScheduleDto,
  LocationDto,
} from '../../models/common';
import { RouteService } from '../../services/route.service';
import { VehicleService } from '../../services/vehicle.service';
import { OperatorService } from '../../services/operators.service';
import { ScheduleService } from '../../services/schedule.service';
import { LocationService } from '../../services/location.service';

/** One editable fare — a single vehicle's fare on a single route, under one operator. */
interface FareCell {
  scheduleId: number;
  vehicleId: number;
  vehicleCode: string;
  vehicleModel: string;
  acType: string | null;
  originalFare: number;
  fare: number;
  dirty: boolean;
  saving: boolean;
  saveError: boolean;
  saved: boolean;
  /** Denormalized context, set once at build time, used for toast copy. */
  operatorName: string;
  routeCode: string;
}

/** One matrix row: an operator, with a list of fare cells per route. */
interface OperatorRow {
  operatorCode: string;
  operatorName: string;
  cellsByRoute: Record<number, FareCell[]>;
  totalBuses: number;
}

/** One matrix column: a route. */
interface RouteColumn {
  id: number;
  code: string; // e.g. "DHK-CTG"
  fromName: string;
  toName: string;
}

/** Data for the compact "fare updated" toast variant. */
interface FareUpdateToastData {
  operatorName: string;
  routeCode: string;
  vehicleModel: string;
  acType: string | null;
  oldFare: number;
  newFare: number;
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'warn' | 'info' | 'fare-update';
  message?: string;
  fareUpdate?: FareUpdateToastData;
}

@Component({
  selector: 'app-fare-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fare-matrix.component.html',
  styleUrls: ['./fare-matrix.component.css'],
})
export class FareMatrixComponent implements OnInit, OnDestroy {
  loading = true;
  error = false;

  routes: RouteDto[] = [];
  vehicles: Vehicle[] = [];
  operators: OperatorDto[] = [];
  schedules: ScheduleDto[] = [];
  locations: LocationDto[] = [];

  routeColumns: RouteColumn[] = [];
  operatorRows: OperatorRow[] = [];

  /** Bus-only for now. */
  vehicleTypeFilter: 'Bus' = 'Bus';

  operatorSearch: string = '';

  toasts: Toast[] = [];
  private _toastId = 0;

  /** Stream of every fare edit — debounced per-schedule so auto-save fires
   *  shortly after the person stops typing, without dropping edits made to
   *  other cells in the meantime. */
  private fareChange$ = new Subject<FareCell>();

  constructor(
    private routeService: RouteService,
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private scheduleService: ScheduleService,
    private locationService: LocationService,
  ) {}

  ngOnInit(): void {
    this.loadAll();
    this.setupAutoSave();
  }

  ngOnDestroy(): void {
    this.fareChange$.complete();
  }

  // ── Auto-save pipeline ───────────────────────────────────────────────────────

  private setupAutoSave(): void {
    this.fareChange$
      .pipe(
        // Isolate edits per schedule so typing in one cell doesn't reset
        // the debounce timer of another cell being edited at the same time.
        groupBy((cell) => cell.scheduleId),
        mergeMap((group$) =>
          group$.pipe(
            debounceTime(600),
            switchMap((cell) => {
              cell.saving = true;
              cell.saveError = false;
              return this.scheduleService
                .updateBaseFare(cell.scheduleId, cell.fare)
                .pipe(
                  catchError((err) => {
                    console.error(
                      `Failed to auto-save schedule ${cell.scheduleId}`,
                      err,
                    );
                    cell.saving = false;
                    cell.saveError = true;
                    this.showToast(
                      'error',
                      `Couldn't save ${cell.vehicleModel}'s fare.`,
                    );
                    return EMPTY;
                  }),
                );
            }),
          ),
        ),
      )
      .subscribe({
        next: (updated: ScheduleDto) => {
          const cell = this.findCellByScheduleId(updated.id);
          if (cell) {
            const oldFare = cell.originalFare;

            cell.originalFare = updated.baseFare;
            cell.fare = updated.baseFare;
            cell.dirty = false;
            cell.saving = false;
            cell.saveError = false;
            cell.saved = true;
            setTimeout(() => {
              cell.saved = false;
            }, 1600);

            // Only announce a real change — skip the toast if the saved
            // value happens to match what was already there.
            if (oldFare !== updated.baseFare) {
              this.showFareUpdateToast({
                operatorName: cell.operatorName,
                routeCode: cell.routeCode,
                vehicleModel: cell.vehicleModel,
                acType: cell.acType,
                oldFare,
                newFare: updated.baseFare,
              });
            }
          }
        },
      });
  }

  private findCellByScheduleId(scheduleId: number): FareCell | undefined {
    for (const row of this.operatorRows) {
      for (const routeId of Object.keys(row.cellsByRoute)) {
        const found = row.cellsByRoute[Number(routeId)].find(
          (c) => c.scheduleId === scheduleId,
        );
        if (found) return found;
      }
    }
    return undefined;
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  private loadAll(): void {
    this.loading = true;
    this.error = false;

    forkJoin({
      routes: this.routeService.getAllRoutes(),
      vehicles: this.vehicleService.getAll(),
      operators: this.operatorService.getAll(),
      schedules: this.scheduleService.getAllSchedules(),
      locations: this.locationService.getAllLocations(),
    }).subscribe({
      next: ({ routes, vehicles, operators, schedules, locations }) => {
        this.routes = routes;
        this.vehicles = vehicles.filter(
          (v) => v.type === this.vehicleTypeFilter,
        );
        this.operators = operators;
        this.schedules = schedules;
        this.locations = locations;
        this.buildMatrix();
        this.loading = false;
      },
      error: (e) => {
        console.error('Failed to load fare matrix data', e);
        this.loading = false;
        this.error = true;
      },
    });
  }

  // ── Matrix construction ──────────────────────────────────────────────────────

  private buildMatrix(): void {
    const locationNameByCode = new Map<string, string>();
    for (const loc of this.locations) {
      if (loc.locationCode) locationNameByCode.set(loc.locationCode, loc.name);
    }

    const busVehicleIds = new Set(this.vehicles.map((v) => v.id));
    const busSchedules = this.schedules.filter((s) =>
      busVehicleIds.has(s.vehicleId),
    );
    const routeIdsWithBusSchedules = new Set(
      busSchedules.map((s) => s.routeId),
    );

    this.routeColumns = this.routes
      .filter((r) => routeIdsWithBusSchedules.has(r.id))
      .map((r) => {
        const fromName =
          locationNameByCode.get(r.departureLocationCode) ??
          r.departureLocationCode ??
          '—';
        const toName =
          locationNameByCode.get(r.destinationLocationCode) ??
          r.destinationLocationCode ??
          '—';
        return {
          id: r.id,
          code: `${this.shortCode(fromName)}-${this.shortCode(toName)}`,
          fromName,
          toName,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    const routeById = new Map(this.routeColumns.map((c) => [c.id, c]));

    const operatorCodesInUse = new Set<string>(
      this.vehicles
        .filter((v) => busSchedules.some((s) => s.vehicleId === v.id))
        .map((v) => v.operatorCode)
        .filter((code): code is string => !!code),
    );

    this.operatorRows = this.operators
      .filter(
        (op) => !!op.operatorCode && operatorCodesInUse.has(op.operatorCode),
      )
      .map((op) => {
        const opVehicles = this.vehicles.filter(
          (v) => v.operatorCode === op.operatorCode,
        );
        const cellsByRoute: Record<number, FareCell[]> = {};
        let totalBuses = 0;

        for (const col of this.routeColumns) {
          const cells: FareCell[] = [];
          for (const v of opVehicles) {
            const schedule = busSchedules.find(
              (s) => s.vehicleId === v.id && s.routeId === col.id,
            );
            if (schedule) {
              cells.push({
                scheduleId: schedule.id,
                vehicleId: v.id,
                vehicleCode: v.vehicleCode,
                vehicleModel: v.model,
                acType: v.acType,
                originalFare: schedule.baseFare,
                fare: schedule.baseFare,
                dirty: false,
                saving: false,
                saveError: false,
                saved: false,
                operatorName: op.name,
                routeCode: routeById.get(col.id)?.code ?? col.code,
              });
            }
          }
          if (cells.length) {
            cellsByRoute[col.id] = cells.sort((a, b) =>
              a.vehicleModel.localeCompare(b.vehicleModel),
            );
            totalBuses += cells.length;
          }
        }

        return {
          operatorCode: op.operatorCode as string,
          operatorName: op.name,
          cellsByRoute,
          totalBuses,
        } as OperatorRow;
      })
      .sort((a, b) => a.operatorName.localeCompare(b.operatorName));
  }

  private shortCode(name: string): string {
    if (!name) return '???';
    const clean = name.replace(/[^a-zA-Z]/g, '');
    return clean.slice(0, 3).toUpperCase() || '???';
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  get filteredOperatorRows(): OperatorRow[] {
    const q = this.operatorSearch.trim().toLowerCase();
    if (!q) return this.operatorRows;
    return this.operatorRows.filter((r) =>
      r.operatorName.toLowerCase().includes(q),
    );
  }

  // ── Cell helpers ─────────────────────────────────────────────────────────────

  getCells(row: OperatorRow, routeId: number): FareCell[] {
    return row.cellsByRoute[routeId] ?? [];
  }

  /** Fires on every keystroke — flags the cell, and (if valid) queues an
   *  auto-save that will actually hit the backend ~600ms after typing stops. */
  onFareChange(cell: FareCell): void {
    cell.dirty = cell.fare !== cell.originalFare;
    cell.saved = false; // cancel any in-progress green pulse

    if (cell.fare == null || cell.fare < 0 || isNaN(cell.fare)) {
      return;
    }

    cell.saveError = false;
    this.fareChange$.next(cell);
  }

  // ── Toast ────────────────────────────────────────────────────────────────────

  showToast(
    type: 'success' | 'error' | 'warn' | 'info',
    message: string,
    durationMs = 3000,
  ): void {
    const id = ++this._toastId;
    this.toasts.push({ id, type, message });
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  /** Compact structured toast shown after a fare successfully auto-saves. */
  showFareUpdateToast(data: FareUpdateToastData, durationMs = 4000): void {
    const id = ++this._toastId;
    this.toasts.push({ id, type: 'fare-update', fareUpdate: data });
    setTimeout(() => this.dismissToast(id), durationMs);
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
  }

  trackToast(_: number, t: { id: number }): number {
    return t.id;
  }

  trackRow(_: number, row: OperatorRow): string {
    return row.operatorCode;
  }

  trackCol(_: number, col: RouteColumn): number {
    return col.id;
  }

  trackCell(_: number, cell: FareCell): number {
    return cell.scheduleId;
  }
}