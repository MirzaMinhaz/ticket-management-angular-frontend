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

  showModal = false;
  showDeleteConfirmModal = false;
  routeToDelete: RouteDto | null = null;

  successMessage = '';
  errorMessage = '';
  modalSuccessMessage = '';
  modalErrorMessage = '';

  currentPage = 1;
  itemsPerPage = 25;
  sortField = '';
  sortAsc = true;
  isSaving = false;

  // flag to temporarily suppress valueChanges during patchValue
  private suppressRouteNameUpdate = false;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService,
    private routeService: RouteService,
    private ngZone: NgZone
  ) { }

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
      routeName:              [{ value: '', disabled: true }],
      estimatedDurationHours: [null, [Validators.required, Validators.min(0)]]
    });

    this.routeForm.get('departureLocation')!.valueChanges.subscribe(() => {
      if (!this.suppressRouteNameUpdate) this.updateRouteName();
    });
    this.routeForm.get('destinationLocation')!.valueChanges.subscribe(() => {
      if (!this.suppressRouteNameUpdate) this.updateRouteName();
    });
  }

  updateRouteName(): void {
    const dep = this.routeForm.get('departureLocation')!.value;
    const dst = this.routeForm.get('destinationLocation')!.value;
    const depName = this.locations.find(l => l.locationCode === dep)?.name || '';
    const dstName = this.locations.find(l => l.locationCode === dst)?.name || '';

    let name = '';
    if (depName && dstName)   name = `${depName} - ${dstName}`;
    else if (depName)         name = `${depName} -`;

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
      departureLocationCode:   '',
      destinationLocationCode: '',
      routeName:               '',
      estimatedDurationHours:  0
    };
  }

  reset(): void {
    this.selectedRoute = this.getEmptyRoute();
    this.suppressRouteNameUpdate = true;
    this.routeForm.reset({
      departureLocation:      '',
      destinationLocation:    '',
      routeName:              '',
      estimatedDurationHours: null
    });
    this.suppressRouteNameUpdate = false;
    this.errorMessage   = '';
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
    this.sortAsc   = this.sortField === field ? !this.sortAsc : true;
    this.sortField = field;
    this.routes.sort((a, b) => {
      const va = a[field]?.toString().toLowerCase() ?? '';
      const vb = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }

  // ─── Save (create or update) ──────────────────────────────────────────────

  save(): void {
    if (this.routeForm.invalid) return;

    const raw = this.routeForm.getRawValue();

    // Ensure routeName was generated (safety net)
    if (!raw.routeName?.trim()) {
      this.updateRouteName();
      raw.routeName = this.routeForm.getRawValue().routeName;
      if (!raw.routeName?.trim()) {
        this.modalErrorMessage = '❌ Route name could not be generated. Please reselect locations.';
        return;
      }
    }

    // ── Explicitly cast to correct types ──────────────────────────────────
    const departureLocationCode   = String(raw.departureLocation);
    const destinationLocationCode = String(raw.destinationLocation);
    const routeName               = String(raw.routeName).trim();
    const estimatedDurationHours  = parseFloat(raw.estimatedDurationHours);

    if (isNaN(estimatedDurationHours)) {
      this.modalErrorMessage = '❌ Please enter a valid duration.';
      return;
    }

    if (this.selectedRoute.id > 0) {
      // ── UPDATE ───────────────────────────────────────────────────────────
      const dto: UpdateRouteDto = {
        departureLocationCode,
        destinationLocationCode,
        routeName,
        estimatedDurationHours
      };

      console.log('Sending update DTO:', dto);  // ← remove after confirming

      this.routeService.updateRoute(this.selectedRoute.id, dto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Route updated successfully!';
          this.modalErrorMessage   = '';
          this.loadRoutes();
          setTimeout(() => this.ngZone.run(() => this.closeModal()), 2000);
        },
        error: err => {
          console.error('Update error:', err);
          this.modalErrorMessage   = err.error?.message || err.error?.title || '❌ Failed to update route.';
          this.modalSuccessMessage = '';
        }
      });

    } else {
      // ── CREATE ───────────────────────────────────────────────────────────
      const dto: CreateRouteDto = {
        departureLocationCode,
        destinationLocationCode,
        routeName,
        estimatedDurationHours
      };

      console.log('Sending create DTO:', dto);  // ← remove after confirming

      this.routeService.createRoute(dto).subscribe({
        next: () => {
          this.successMessage = '✅ Route created successfully!';
          this.errorMessage   = '';
          this.loadRoutes();
          this.reset();
          this.autoClear('page', 3000);
        },
        error: err => {
          console.error('Create error:', err);
          this.errorMessage   = err.error?.message || err.error?.title || '❌ Failed to create route.';
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

    // Suppress valueChanges during patch so routeName isn't wiped
    this.suppressRouteNameUpdate = true;

    this.routeForm.patchValue({
      departureLocation:      route.departureLocationCode,
      destinationLocation:    route.destinationLocationCode,
      estimatedDurationHours: route.estimatedDurationHours
    });

    this.suppressRouteNameUpdate = false;

    // Now manually build the route name with correct location data
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
        this.routes         = this.routes.filter(r => r.id !== this.routeToDelete!.id);
        this.successMessage = '✅ Route deleted successfully!';
        this.cancelDelete();
        this.autoClear('page', 3000);
      },
      error: err => {
        console.error('Delete error:', err);
        this.errorMessage = '❌ Failed to delete route.';
        this.cancelDelete();
        this.autoClear('page', 3000);
      }
    });
  }
}