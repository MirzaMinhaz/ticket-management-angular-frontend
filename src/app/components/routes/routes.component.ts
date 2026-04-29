import { Component, OnInit, NgZone } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LocationDto, RouteDto, CreateRouteDto, UpdateRouteDto } from '../../models/common';
import { LocationService } from '../../services/location.service';
import { RouteService } from '../../services/route.service';

@Component({
  selector: 'app-routes',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './routes.component.html',
  styleUrls: ['./routes.component.css']
})
export class RoutesComponent implements OnInit {

  routes: RouteDto[] = [];
  locations: LocationDto[] = [];

  routeForm!: FormGroup;
  selectedRoute: RouteDto = this.getEmptyRoute();

  // flags & messages
  showModal = false;
  showDeleteConfirmModal = false;
  routeToDelete: RouteDto | null = null;

  successMessage = '';
  errorMessage = '';
  modalSuccessMessage = '';
  modalErrorMessage = '';

  // pagination
  currentPage = 1;
  itemsPerPage = 25;

  // sorting
  sortField = '';
  sortAsc = true;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService,
    private routeService: RouteService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadLocations();
    this.loadRoutes();
  }

  // ─── Form ────────────────────────────────────────────────────────────────

  buildForm(): void {
    this.routeForm = this.fb.group({
      departureLocation:      ['', Validators.required],
      destinationLocation:    ['', Validators.required],
      routeName:              [{ value: '', disabled: true }, Validators.required],
      estimatedDurationHours: ['', [Validators.required, Validators.min(0)]]
    });

    // Auto-build route name whenever departure/destination changes
    this.routeForm.get('departureLocation')!.valueChanges.subscribe(() => this.updateRouteName());
    this.routeForm.get('destinationLocation')!.valueChanges.subscribe(() => this.updateRouteName());
  }

  updateRouteName(): void {
    const dep = this.routeForm.get('departureLocation')!.value;
    const dst = this.routeForm.get('destinationLocation')!.value;
    const depName = this.locations.find(l => l.locationCode === dep)?.name || '';
    const dstName = this.locations.find(l => l.locationCode === dst)?.name || '';

    let name = '';
    if (depName && dstName)  name = `${depName} - ${dstName}`;
    else if (depName)        name = `${depName} -`;

    this.routeForm.get('routeName')!.setValue(name, { emitEvent: false });
  }

  // ─── Data loading ─────────────────────────────────────────────────────────

  loadRoutes(): void {
    this.routeService.getAllRoutes().subscribe({
      next:  data => this.routes = data,
      error: err  => console.error('Failed to load routes', err)
    });
  }

  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next:  data => this.locations = data,
      error: err  => console.error('Failed to load locations', err)
    });
  }

  // ─── Pagination ───────────────────────────────────────────────────────────

  get paginatedCounters(): RouteDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.routes.slice(start, start + this.itemsPerPage);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getLocationName(code: string | undefined): string {
    return this.locations.find(l => l.locationCode === code)?.name ?? '—';
  }

  getEmptyRoute(): RouteDto {
    return {
      id: 0,
      departureLocationCode: '',
      destinationLocationCode: '',
      routeName: '',
      estimatedDurationHours: 0
    };
  }

  reset(): void {
    this.selectedRoute = this.getEmptyRoute();
    this.routeForm.reset({
      departureLocation:      '',
      destinationLocation:    '',
      routeName:              '',
      estimatedDurationHours: ''
    });
    this.errorMessage = '';
    this.successMessage = '';
  }

  autoClear(target: 'page' | 'modal', ms = 3000): void {
    setTimeout(() => this.ngZone.run(() => {
      if (target === 'page')  { this.successMessage = ''; this.errorMessage = ''; }
      if (target === 'modal') { this.modalSuccessMessage = ''; this.modalErrorMessage = ''; }
    }), ms);
  }

  // ─── Sorting ──────────────────────────────────────────────────────────────

  sortBy(field: keyof RouteDto): void {
    this.sortAsc = this.sortField === field ? !this.sortAsc : true;
    this.sortField = field;
    this.routes.sort((a, b) => {
      const va = a[field]?.toString().toLowerCase() ?? '';
      const vb = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  // ─── Create / Update (save) ───────────────────────────────────────────────

  save(): void {
    if (this.routeForm.invalid) return;

    const raw = this.routeForm.getRawValue();   // getRawValue() includes disabled controls

    if (this.selectedRoute.id > 0) {
      // ── UPDATE ──
      const dto: UpdateRouteDto = {
        departureLocationCode:   raw.departureLocation,
        destinationLocationCode: raw.destinationLocation,
        routeName:               raw.routeName,
        estimatedDurationHours:  raw.estimatedDurationHours
      };

      this.routeService.updateRoute(this.selectedRoute.id, dto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Route updated successfully!';
          this.modalErrorMessage   = '';
          this.loadRoutes();

          setTimeout(() => this.ngZone.run(() => {
            this.closeModal();
          }), 2000);
        },
        error: err => {
          console.error('Failed to update route', err);
          this.modalErrorMessage   = err.error?.message || '❌ Failed to update route.';
          this.modalSuccessMessage = '';
          this.autoClear('modal', 3000);
        }
      });

    } else {
      // ── CREATE ──
      const dto: CreateRouteDto = {
        departureLocationCode:   raw.departureLocation,
        destinationLocationCode: raw.destinationLocation,
        routeName:               raw.routeName,
        estimatedDurationHours:  raw.estimatedDurationHours
      };

      this.routeService.createRoute(dto).subscribe({
        next: () => {
          this.successMessage = '✅ Route created successfully!';
          this.errorMessage   = '';
          this.loadRoutes();
          this.reset();
          this.autoClear('page', 3000);
        },
        error: err => {
          console.error('Failed to create route', err);
          this.errorMessage   = err.error?.message || '❌ Failed to create route.';
          this.successMessage = '';
          this.autoClear('page', 3000);
        }
      });
    }
  }

  // ─── Edit modal ───────────────────────────────────────────────────────────

  openModal(route: RouteDto): void {
    this.selectedRoute       = { ...route };
    this.modalSuccessMessage = '';
    this.modalErrorMessage   = '';

    // Reset first so valueChanges subscribers don't fire with stale state
    this.routeForm.reset({
      departureLocation:      '',
      destinationLocation:    '',
      routeName:              '',
      estimatedDurationHours: ''
    }, { emitEvent: false });

    // Patch departure & destination; updateRouteName() will rebuild the name
    this.routeForm.patchValue({
      departureLocation:      route.departureLocationCode,
      destinationLocation:    route.destinationLocationCode,
      estimatedDurationHours: route.estimatedDurationHours
    });

    // Explicitly set routeName in case locations loaded before patch fired
    this.updateRouteName();

    this.showModal = true;
  }

  closeModal(): void {
    this.showModal           = false;
    this.modalSuccessMessage = '';
    this.modalErrorMessage   = '';
    this.reset();
  }

  // ─── Delete modal ─────────────────────────────────────────────────────────

  confirmDelete(route: RouteDto): void {
    this.routeToDelete          = route;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.routeToDelete          = null;
    this.showDeleteConfirmModal = false;
  }

  deleteRoute(): void {
    if (!this.routeToDelete) return;

    this.routeService.deleteRoute(this.routeToDelete.id).subscribe({
      next: () => {
        this.routes        = this.routes.filter(r => r.id !== this.routeToDelete!.id);
        this.successMessage = '✅ Route deleted successfully!';
        this.cancelDelete();
        this.autoClear('page', 3000);
      },
      error: err => {
        console.error('Failed to delete route', err);
        this.errorMessage = '❌ Failed to delete route.';
        this.cancelDelete();
        this.autoClear('page', 3000);
      }
    });
  }
}