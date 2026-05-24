import { Component, OnInit, NgZone } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { LocationDto, RouteDto, CreateRouteDto, UpdateRouteDto } from '../../models/common';
import { LocationService } from '../../services/location.service';
import { RouteService } from '../../services/route.service';

/** Cross-field validator: departure and destination must differ */
export const sameLocationValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const dep = group.get('departureLocation')?.value;
  const dst = group.get('destinationLocation')?.value;
  return dep && dst && dep === dst ? { sameLocation: true } : null;
};

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

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

  /** Add-form (page level) */
  routeForm!: FormGroup;

  /** Separate edit-form used only inside the modal — avoids the shared-form bug */
  editForm!: FormGroup;

  selectedRoute: RouteDto | null = null;

  showModal = false;
  showDeleteConfirmModal = false;
  routeToDelete: RouteDto | null = null;

  toasts: Toast[] = [];
  private toastCounter = 0;

  currentPage = 1;
  itemsPerPage = 25;
  sortField = '';
  sortAsc = true;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private locationService: LocationService,
    private routeService: RouteService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.buildEditForm();
    this.loadLocations();
    this.loadRoutes();
  }

  // ─── Forms ────────────────────────────────────────────────────────────────

  buildForm(): void {
    this.routeForm = this.fb.group({
      departureLocation:      ['', Validators.required],
      destinationLocation:    ['', Validators.required],
      routeName:              [{ value: '', disabled: true }],
      estimatedDurationHours: [null, [Validators.required, Validators.min(0)]]
    }, { validators: sameLocationValidator });

    this.routeForm.get('departureLocation')!.valueChanges.subscribe(() => {
      this.syncRouteName(this.routeForm);
      // Re-trigger destination touched state so error shows immediately
      this.routeForm.get('destinationLocation')!.updateValueAndValidity({ emitEvent: false });
    });
    this.routeForm.get('destinationLocation')!.valueChanges.subscribe(() => this.syncRouteName(this.routeForm));
  }

  buildEditForm(): void {
    this.editForm = this.fb.group({
      departureLocation:      ['', Validators.required],
      destinationLocation:    ['', Validators.required],
      routeName:              [{ value: '', disabled: true }],
      estimatedDurationHours: [null, [Validators.required, Validators.min(0)]]
    }, { validators: sameLocationValidator });

    this.editForm.get('departureLocation')!.valueChanges.subscribe(() => {
      this.syncRouteName(this.editForm);
      this.editForm.get('destinationLocation')!.updateValueAndValidity({ emitEvent: false });
    });
    this.editForm.get('destinationLocation')!.valueChanges.subscribe(() => this.syncRouteName(this.editForm));
  }

  syncRouteName(form: FormGroup): void {
    const dep = form.get('departureLocation')!.value;
    const dst = form.get('destinationLocation')!.value;
    const depName = this.locations.find(l => l.locationCode === dep)?.name ?? '';
    const dstName = this.locations.find(l => l.locationCode === dst)?.name ?? '';

    let name = '';
    if (depName && dstName) name = `${depName} - ${dstName}`;
    else if (depName)       name = `${depName} -`;

    form.get('routeName')!.setValue(name, { emitEvent: false });
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

  get totalPages(): number {
    return Math.ceil(this.routes.length / this.itemsPerPage);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getLocationName(code: string | undefined): string {
    return this.locations.find(l => l.locationCode === code)?.name ?? '—';
  }

  reset(): void {
    this.routeForm.reset({
      departureLocation:      '',
      destinationLocation:    '',
      routeName:              '',
      estimatedDurationHours: null
    });
    this.routeForm.markAsPristine();
    this.routeForm.markAsUntouched();
  }

  // ─── Toast notifications ─────────────────────────────────────────────────

  showToast(message: string, type: 'success' | 'error', duration = 3500): void {
    const id = ++this.toastCounter;
    const toast: Toast = { id, message, type };
    this.toasts.push(toast);
    setTimeout(() => this.ngZone.run(() => this.dismissToast(toast)), duration);
  }

  dismissToast(toast: Toast): void {
    this.toasts = this.toasts.filter(t => t.id !== toast.id);
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

  // ─── Save (CREATE only — page form) ───────────────────────────────────────

  save(): void {
    this.routeForm.markAllAsTouched();
    if (this.routeForm.invalid) return;
    if (this.routeForm.hasError('sameLocation')) {
      this.showToast('⚠️ Departure and destination cannot be the same location.', 'error');
      return;
    }

    const raw = this.routeForm.getRawValue();
    this.syncRouteName(this.routeForm);
    const routeName = this.routeForm.getRawValue().routeName?.trim();

    if (!routeName) {
      this.showToast('❌ Route name could not be generated. Please reselect locations.', 'error');
      return;
    }

    const dto: CreateRouteDto = {
      departureLocationCode:   String(raw.departureLocation),
      destinationLocationCode: String(raw.destinationLocation),
      routeName,
      estimatedDurationHours:  parseFloat(raw.estimatedDurationHours)
    };

    if (isNaN(dto.estimatedDurationHours)) {
      this.showToast('❌ Please enter a valid duration.', 'error');
      return;
    }

    this.isSaving = true;
    this.routeService.createRoute(dto).subscribe({
      next: () => {
        this.isSaving = false;
        this.showToast(' Route created successfully!', 'success');
        this.loadRoutes();
        this.reset();
      },
      error: err => {
        this.isSaving = false;
        const msg = err.error?.message || err.error?.title || '❌ Failed to create route.';
        this.showToast(msg, 'error');
      }
    });
  }

  // ─── Edit modal ───────────────────────────────────────────────────────────

  openModal(route: RouteDto): void {
    this.selectedRoute = { ...route };

    // Patch the SEPARATE editForm — not routeForm
    this.editForm.patchValue({
      departureLocation:      route.departureLocationCode,
      destinationLocation:    route.destinationLocationCode,
      estimatedDurationHours: route.estimatedDurationHours
    }, { emitEvent: false });

    // Manually set the route name after patching
    this.editForm.get('routeName')!.setValue(route.routeName, { emitEvent: false });

    this.editForm.markAsPristine();
    this.editForm.markAsUntouched();

    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedRoute = null;
    this.editForm.reset();
  }

  saveEdit(): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid || !this.selectedRoute) return;
    if (this.editForm.hasError('sameLocation')) {
      this.showToast('⚠️ Departure and destination cannot be the same location.', 'error');
      return;
    }

    const raw = this.editForm.getRawValue();
    this.syncRouteName(this.editForm);
    const routeName = this.editForm.getRawValue().routeName?.trim();

    if (!routeName) {
      this.showToast('❌ Route name could not be generated.', 'error');
      return;
    }

    const estimatedDurationHours = parseFloat(raw.estimatedDurationHours);
    if (isNaN(estimatedDurationHours)) {
      this.showToast('❌ Please enter a valid duration.', 'error');
      return;
    }

    const dto: UpdateRouteDto = {
      departureLocationCode:   String(raw.departureLocation),
      destinationLocationCode: String(raw.destinationLocation),
      routeName,
      estimatedDurationHours
    };

    this.isSaving = true;
    this.routeService.updateRoute(this.selectedRoute.id, dto).subscribe({
      next: () => {
        this.isSaving = false;
        this.showToast('✅ Route updated successfully!', 'success');
        this.loadRoutes();
        setTimeout(() => this.ngZone.run(() => this.closeModal()), 400);
      },
      error: err => {
        this.isSaving = false;
        const msg = err.error?.message || err.error?.title || '❌ Failed to update route.';
        this.showToast(msg, 'error');
      }
    });
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

    this.isSaving = true;
    this.routeService.deleteRoute(this.routeToDelete.id).subscribe({
      next: () => {
        this.isSaving = false;
        this.routes   = this.routes.filter(r => r.id !== this.routeToDelete!.id);
        this.showToast('✅ Route deleted successfully!', 'success');
        this.cancelDelete();
      },
      error: err => {
        this.isSaving = false;
        console.error('Delete error:', err);
        this.showToast('❌ Failed to delete route.', 'error');
        this.cancelDelete();
      }
    });
  }
}