import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto, LocationDto } from '../../models/common';
import { LocationService } from '../../services/location.service';
import { Subject, Observable, of } from 'rxjs';
import { exhaustMap, catchError, finalize, tap } from 'rxjs/operators';

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

  successMessage: string = '';
  modalSuccessMessage: string = '';
  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 30;
  sortField: string = '';
  sortAsc: boolean = true;

  counterToToDelete: TicketCounterDto | null = null;
  showDeleteConfirmModal: boolean = false;

  // ✅ Pre-submit validation state
  validationErrors: { [key: string]: string } = {};

  // ✅ True while a create/update request is actually in flight.
  // Used to disable the Save button and show a "Saving..." state.
  isSaving: boolean = false;

  // ✅ Every click on "Save"/"Update" pushes into this Subject instead of
  // calling the HTTP service directly. exhaustMap() below ignores any new
  // emissions while a previous save is still in progress, which is what
  // actually prevents duplicate create/update requests from double-clicks
  // or a slow network + impatient user.
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
    // Good practice: close the Subject so its internal subscription
    // doesn't linger after the component is destroyed.
    this.saveTrigger$.complete();
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
                this.validationErrors = {
                  ...this.validationErrors,
                  server: '❌ Failed to save. Please check your input and try again.'
                };
              });
              // Swallow the error here so the outer stream stays alive
              // and can accept the next save attempt.
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

  // Builds and fires off the actual create/update HTTP call.
  // Returns an Observable so exhaustMap can manage its lifecycle.
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
            this.modalSuccessMessage = '✅ Counter updated successfully!';
            this.loadCounters();

            setTimeout(() => {
              this.ngZone.run(() => {
                this.closeModal();
                this.modalSuccessMessage = '';
              });
            }, 2000);
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
            this.successMessage = '✅ Counter created successfully!';
            this.loadCounters();
            this.reset();
            this.autoClearMessage();
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
        this.successMessage = '🗑️ Ticket Counter deleted successfully!';
        this.autoClearMessage();
      },
      error: err => console.error('Failed to delete Ticket Counter', err)
    });
  }

  delete(id: number): void {
    this.counterService.deleteTicketCounter(id).subscribe({
      next: () => this.loadCounters(),
      error: err => console.error('Failed to delete counter', err)
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

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
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