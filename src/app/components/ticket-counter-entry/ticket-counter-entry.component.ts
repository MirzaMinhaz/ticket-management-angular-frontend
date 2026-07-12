import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto, LocationDto } from '../../models/common';
import { LocationService } from '../../services/location.service';
import { Subject, Observable, of } from 'rxjs';
import { exhaustMap, catchError, finalize, tap } from 'rxjs/operators';

interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
  leaving?: boolean;
}

@Component({
  selector: 'app-ticket-counter-entry',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-counter-entry.component.html',
  styleUrls: ['./ticket-counter-entry.component.css']
})
export class TicketCounterEntryComponent implements OnInit, OnDestroy {
  counters: TicketCounterDto[] = [];
  selectedCounter: TicketCounterDto = this.getEmptyCounter();
  selectedLocationCode: string = '';
  locations: LocationDto[] = [];

  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 30;
  sortField: string = '';
  sortAsc: boolean = true;

  counterToToDelete: TicketCounterDto | null = null;
  showDeleteConfirmModal: boolean = false;

  // ✅ Pre-submit field validation (unrelated to toasts — stays inline under fields)
  validationErrors: { [key: string]: string } = {};

  // ✅ True while a create/update request is actually in flight.
  isSaving: boolean = false;

  // ✅ Toast notifications — top-right, auto-dismiss after 3s, closable
  toasts: ToastMessage[] = [];
  private toastIdCounter = 0;
  private readonly TOAST_DURATION_MS = 3000;

  // ✅ Save requests flow through this Subject; exhaustMap ignores new
  // emissions while a save is already in progress (prevents double submit).
  private saveTrigger$ = new Subject<void>();

  constructor(
    private counterService: TicketCounterService,
    private locationService: LocationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadCounters();
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
              console.error('Failed to save ticket counter', err);
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
    const isUpdate = this.selectedCounter.id > 0;

    if (isUpdate) {
      const updateDto: UpdateTicketCounterDto = {
        locationCode: this.selectedLocationCode,
        counterName: this.selectedCounter.counterName.trim(),
        addressDetails: this.selectedCounter.addressDetails?.trim(),
        contactNumber: this.selectedCounter.contactNumber?.trim()
      };

      return this.counterService.updateTicketCounter(this.selectedCounter.id, updateDto).pipe(
        tap(() => {
          this.ngZone.run(() => {
            this.loadCounters();
            this.closeModal();
            this.showToast('Counter updated successfully.', 'success');
          });
        })
      );
    } else {
      const createDto: CreateTicketCounterDto = {
        locationCode: this.selectedLocationCode,
        counterName: this.selectedCounter.counterName.trim(),
        addressDetails: this.selectedCounter.addressDetails?.trim(),
        contactNumber: this.selectedCounter.contactNumber?.trim()
      };

      return this.counterService.createTicketCounter(createDto).pipe(
        tap(() => {
          this.ngZone.run(() => {
            this.loadCounters();
            this.reset();
            this.showToast('Counter created successfully.', 'success');
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

    if (!this.selectedCounter.counterName || !this.selectedCounter.counterName.trim()) {
      errors['counterName'] = 'Counter name is required.';
    }

    if (!this.selectedLocationCode || !this.selectedLocationCode.trim()) {
      errors['locationCode'] = 'Please select a location.';
    }

    if (this.selectedCounter.contactNumber && this.selectedCounter.contactNumber.trim()) {
      const phonePattern = /^[0-9+\-\s]{6,20}$/;
      if (!phonePattern.test(this.selectedCounter.contactNumber.trim())) {
        errors['contactNumber'] = 'Enter a valid contact number (digits, spaces, + or - only).';
      }
    }

    this.validationErrors = errors;
    return Object.keys(errors).length === 0;
  }

  // -------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------
  loadCounters(): void {
    this.counterService.getAllTicketCounters().subscribe({
      next: data => (this.counters = data),
      error: err => console.error('Failed to load counters', err)
    });
  }

  loadLocations(): void {
    this.locationService.getAllLocations().subscribe({
      next: data => (this.locations = data),
      error: err => console.error('Failed to load locations', err)
    });
  }

  // -------------------------------------------------------------------
  // Pagination
  // -------------------------------------------------------------------
  get paginatedCounters(): TicketCounterDto[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.counters.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.counters.length / this.itemsPerPage);
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

  getLocationName(code: string | undefined): string | undefined {
    return this.locations.find(loc => loc.locationCode === code)?.name;
  }

  // -------------------------------------------------------------------
  // Modal handling
  // -------------------------------------------------------------------
  openModal(counter: TicketCounterDto): void {
    this.selectedCounter = { ...counter };
    this.selectedLocationCode = counter.locationCode;
    this.validationErrors = {};
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  confirmDelete(ticketCounter: TicketCounterDto): void {
    this.counterToToDelete = ticketCounter;
    this.showDeleteConfirmModal = true;
  }

  cancelDelete(): void {
    this.counterToToDelete = null;
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
    if (!this.counterToToDelete) return;

    this.counterService.deleteTicketCounter(this.counterToToDelete.id).subscribe({
      next: () => {
        this.loadCounters();
        this.showDeleteConfirmModal = false;
        this.counterToToDelete = null;
        this.showToast('Ticket counter deleted successfully.', 'success');
      },
      error: err => {
        console.error('Failed to delete Ticket Counter', err);
        this.showToast('Failed to delete counter. Please try again.', 'error');
      }
    });
  }

  reset(): void {
    this.selectedCounter = this.getEmptyCounter();
    this.selectedLocationCode = '';
    this.validationErrors = {};
  }

  getEmptyCounter(): TicketCounterDto {
    return {
      id: 0,
      locationCode: '',
      counterName: '',
      counterCode: '',
      addressDetails: '',
      contactNumber: '',
      operatingHours: '',
      isActive: true,
      createdAt: '',
      createdBy: ''
    };
  }

  sortBy(field: keyof TicketCounterDto): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.counters.sort((a, b) => {
      const valA = a[field]?.toString().toLowerCase() ?? '';
      const valB = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }
}