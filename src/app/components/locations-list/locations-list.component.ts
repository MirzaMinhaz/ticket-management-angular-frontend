import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../services/location.service';
import { LocationDto, CreateLocationDto, UpdateLocationDto } from '../../models/common';
import { Subject, Observable, of } from 'rxjs';
import { exhaustMap, catchError, finalize, tap } from 'rxjs/operators';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
  leaving?: boolean;
}

@Component({
  selector: 'app-locations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.css']
})
export class LocationsListComponent implements OnInit, OnDestroy {
  locations: LocationDto[] = [];
  selectedLocation: LocationDto = this.getEmptyLocation();

  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 30;
  sortField: string = '';
  sortAsc: boolean = true;

  locationToDelete: LocationDto | null = null;
  showDeleteConfirmModal: boolean = false;

  // Pre-submit field validation (unrelated to toasts — stays inline under fields)
  validationErrors: { [key: string]: string } = {};

  // True while a create/update request is actually in flight.
  isSaving: boolean = false;

  // Toast notifications — top-right, auto-dismiss after 3s, closable
  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;
  private readonly TOAST_DURATION_MS = 3000;

  // Save requests flow through this Subject; exhaustMap ignores new
  // emissions while a save is already in progress (prevents double submit).
  private saveTrigger$ = new Subject<void>();

  constructor(
    private locationService: LocationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadLocations();
    this.setupSaveStream();
  }

  ngOnDestroy(): void {
    this.saveTrigger$.complete();
  }

  // -------------------------------------------------------------------
  // Toast notifications
  // -------------------------------------------------------------------
  showToast(message: string, type: 'success' | 'error' = 'success'): void {
    const toast: ToastMessage = { id: ++this.toastIdCounter, message, type };
    this.toasts = [...this.toasts, toast];

    setTimeout(() => this.dismissToast(toast.id), this.TOAST_DURATION_MS);
  }

  dismissToast(id: number): void {
    const toast = this.toasts.find(t => t.id === id);
    if (!toast || toast.leaving) {
      return;
    }

    // Mark as leaving first so the exit animation can play,
    // then remove it from the array once the animation finishes.
    toast.leaving = true;

    setTimeout(() => {
      this.ngZone.run(() => {
        this.toasts = this.toasts.filter(t => t.id !== id);
      });
    }, 200);
  }

  // -------------------------------------------------------------------
  // exhaustMap save pipeline
  // -------------------------------------------------------------------
  private setupSaveStream(): void {
    this.saveTrigger$
      .pipe(
        exhaustMap(() => {
          this.ngZone.run(() => (this.isSaving = true));

          return this.performSave().pipe(
            catchError(err => {
              console.error('Failed to save location', err);
              this.ngZone.run(() => {
                this.showToast('Failed to save. Please check your input and try again.', 'error');
              });
              return of(null);
            }),
            finalize(() => {
              this.ngZone.run(() => (this.isSaving = false));
            })
          );
        })
      )
      .subscribe();
  }

  private performSave(): Observable<any> {
    const isUpdate = this.selectedLocation.id > 0;

    if (isUpdate) {
      const updateDto: UpdateLocationDto = {
        name: this.selectedLocation.name.trim(),
        type: this.selectedLocation.type.trim(),
        address: this.selectedLocation.address.trim()
      };

      return this.locationService.updateLocation(this.selectedLocation.id, updateDto).pipe(
        tap(() => {
          this.ngZone.run(() => {
            this.loadLocations();
            this.closeModal();
            this.showToast('Location updated successfully.', 'success');
          });
        })
      );
    } else {
      const createDto: CreateLocationDto = {
        name: this.selectedLocation.name.trim(),
        type: this.selectedLocation.type.trim(),
        address: this.selectedLocation.address.trim()
      };

      return this.locationService.createLocation(createDto).pipe(
        tap(() => {
          this.ngZone.run(() => {
            this.loadLocations();
            this.reset();
            this.showToast('Location created successfully.', 'success');
          });
        })
      );
    }
  }

  // -------------------------------------------------------------------
  // Pre-submit validation
  // -------------------------------------------------------------------
  private validateForm(): boolean {
    const errors: { [key: string]: string } = {};

    if (!this.selectedLocation.name || !this.selectedLocation.name.trim()) {
      errors['name'] = 'Name is required.';
    }

    if (!this.selectedLocation.type || !this.selectedLocation.type.trim()) {
      errors['type'] = 'Please select a type.';
    }

    if (!this.selectedLocation.address || !this.selectedLocation.address.trim()) {
      errors['address'] = 'Address is required.';
    }

    this.validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------
  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: data => (this.locations = data),
      error: err => console.error('Failed to load locations', err)
    });
  }

  // -------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------
  get paginatedLocations(): LocationDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.locations.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.locations.length / this.itemsPerPage);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  goToPage(page: number): void {
    this.currentPage = page;
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  // -------------------------------------------------------------------
  // Modal handling
  // -------------------------------------------------------------------
  openModal(location: LocationDto): void {
    this.selectedLocation = { ...location };
    this.validationErrors = {};
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  confirmDelete(location: LocationDto): void {
    this.locationToDelete = location;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.locationToDelete = null;
    this.showDeleteConfirmModal = false;
  }

  // -------------------------------------------------------------------
  // Save entry point — called from the template (ngSubmit)
  // -------------------------------------------------------------------
  save(): void {
    this.validationErrors = {};

    if (!this.validateForm()) {
      return; // stop here — no HTTP call fired, no chance of a 400
    }

    if (this.isSaving) {
      return; // extra guard; exhaustMap already covers this
    }

    this.saveTrigger$.next();
  }

  deleteConfirmed(): void {
    if (!this.locationToDelete) return;

    this.locationService.deleteLocation(this.locationToDelete.id).subscribe({
      next: () => {
        this.loadLocations();
        this.showDeleteConfirmModal = false;
        this.locationToDelete = null;
        this.showToast('Location deleted successfully.', 'success');
      },
      error: err => {
        console.error('Failed to delete location', err);
        this.showToast('Failed to delete location. Please try again.', 'error');
      }
    });
  }

  reset(): void {
    this.selectedLocation = this.getEmptyLocation();
    this.validationErrors = {};
  }

  getEmptyLocation(): LocationDto {
    return {
      id: 0,
      locationCode: '',
      name: '',
      type: '',
      address: '',
      createdAt: '',
      lastModifiedAt: '',
      createdBy: '',
      lastModifiedBy: ''
    };
  }

  sortBy(field: keyof LocationDto): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.locations = [...this.locations].sort((a, b) => {
      const valA = (a[field] ?? '').toString().toLowerCase();
      const valB = (b[field] ?? '').toString().toLowerCase();
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }
}