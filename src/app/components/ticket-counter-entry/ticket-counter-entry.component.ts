import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { LocationService } from '../../services/location.service';
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto, LocationDto } from '../../models/common';
import { catchError, finalize } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ticket-counter-entry',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './ticket-counter-entry.component.html',
  styleUrls: ['./ticket-counter-entry.component.css']
})
export class TicketCounterEntryComponent implements OnInit {
  ticketCounterForm: FormGroup;
  locations: LocationDto[] = [];
  isEditMode = false;
  ticketCounterId: string | null = null; // ID is string as per your DTO (Assuming string for TicketCounterDto ID for now)
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Define static operating hours
  readonly staticOperatingHours = '7:00 AM - 11:00 PM';

  constructor(
    private fb: FormBuilder,
    private ticketCounterService: TicketCounterService,
    private locationService: LocationService,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.ticketCounterForm = this.fb.group({
      locationId: ['', Validators.required],
      counterName: ['', Validators.required],
      counterCode: [{ value: '', disabled: true }],
      addressDetails: [''],
      contactNumber: [''],
      operatingHours: [this.staticOperatingHours], // Initialize with static value
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.ticketCounterId = this.route.snapshot.paramMap.get('id');

    this.loading = true;
    this.errorMessage = null;

    this.locationService.getAllLocations().pipe(
      catchError(error => {
        this.errorMessage = 'Failed to load locations: ' + (error.message || 'Unknown error');
        console.error('Error fetching locations:', error);
        return of([]);
      }),
      finalize(() => {
        if (this.locations.length === 0) {
          this.ticketCounterForm.get('locationId')?.disable();
        }
        if (!this.isEditMode && this.locations.length > 0) {
          this.loading = false;
        }
        // Ensure loading is false even if there are no locations and not in edit mode
        if (!this.isEditMode && this.locations.length === 0) {
          this.loading = false;
        }
      })
    ).subscribe(locations => {
      this.locations = locations;
      if (!this.isEditMode && this.locations.length > 0) {
        this.ticketCounterForm.get('locationId')?.setValue(this.locations[0].locationId); // Changed .locationId to .id
      }

      if (this.ticketCounterId) {
        this.isEditMode = true;
        this.loadTicketCounterForEdit(this.ticketCounterId);
      }
    });
  }

  loadTicketCounterForEdit(id: string): void {
    this.loading = true;
    this.ticketCounterService.getTicketCounterById(id).pipe(
      catchError(error => {
        this.errorMessage = 'Failed to load ticket counter for edit: ' + (error.message || 'Unknown error');
        console.error('Error fetching ticket counter for edit:', error);
        this.router.navigate(['/ticket-counters']);
        return of(null);
      }),
      finalize(() => this.loading = false)
    ).subscribe(counter => {
      if (counter) {
        this.ticketCounterForm.get('counterCode')?.enable();
        this.ticketCounterForm.patchValue({
          locationId: counter.locationId, // Assuming TicketCounterDto still uses locationId
          counterName: counter.counterName,
          counterCode: counter.counterCode,
          addressDetails: counter.addressDetails,
          contactNumber: counter.contactNumber,
          operatingHours: counter.operatingHours || this.staticOperatingHours, // Use existing or fallback to static
          isActive: counter.isActive
        });
        this.ticketCounterForm.get('counterCode')?.disable(); // Keep disabled if you only want it for display
        // Also disable operatingHours if you want to ensure it remains static for edits too
        this.ticketCounterForm.get('operatingHours')?.disable();
      }
    });
  }

  onSubmit(): void {
    if (this.ticketCounterForm.invalid) {
      this.ticketCounterForm.markAllAsTouched();
      this.errorMessage = 'Please correct the form errors.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    // Use getRawValue to get values from disabled controls.
    // We'll explicitly pick fields for DTOs.
    const formValue = this.ticketCounterForm.getRawValue();

    if (this.isEditMode && this.ticketCounterId) {
      const updateDto: UpdateTicketCounterDto = {
        locationId: formValue.locationId,
        counterName: formValue.counterName,
        addressDetails: formValue.addressDetails || undefined,
        contactNumber: formValue.contactNumber || undefined,
        operatingHours: this.staticOperatingHours, // Always send static value for update
        isActive: formValue.isActive
      };

      this.ticketCounterService.updateTicketCounter(this.ticketCounterId, updateDto).pipe(
        catchError(error => {
          this.errorMessage = error.message || 'Failed to update ticket counter.';
          console.error('Update error:', error);
          return of(null);
        }),
        finalize(() => this.loading = false)
      ).subscribe(result => {
        if (result !== null) {
          this.successMessage = 'Ticket Counter updated successfully!';
          setTimeout(() => this.router.navigate(['/ticket-counters']), 2000);
        }
      });
    } else {
      const createDto: CreateTicketCounterDto = {
        locationId: formValue.locationId,
        counterName: formValue.counterName,
        addressDetails: formValue.addressDetails || undefined,
        contactNumber: formValue.contactNumber || undefined,
        operatingHours: this.staticOperatingHours, // Always send static value for creation
        isActive: formValue.isActive
      };
      this.ticketCounterService.createTicketCounter(createDto).pipe(
        catchError(error => {
          this.errorMessage = error.message || 'Failed to create ticket counter.';
          console.error('Creation error:', error);
          return of(null);
        }),
        finalize(() => this.loading = false)
      ).subscribe(createdCounter => {
        if (createdCounter) {
          this.successMessage = `Ticket Counter "${createdCounter.counterName}" created successfully!`;
          this.ticketCounterForm.reset();
          if (this.locations.length > 0) {
            this.ticketCounterForm.get('locationId')?.setValue(this.locations[0].locationId); // Changed .locationId to .id
          }
          this.ticketCounterForm.get('isActive')?.setValue(true);
          // this.ticketCounterForm.get('operatingHours')?.setValue(this.staticOperatingHours); // Reset static hours
          this.ticketCounterForm.get('counterCode')?.disable(); // Keep disabled
          this.ticketCounterForm = this.fb.group({
            operatingHours: [{ value: '7:00 AM - 11:00 PM', disabled: true }]
          });
        }
      });
    }
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.ticketCounterForm.get(fieldName);
    return control ? control.invalid && (control.touched || control.dirty) : false;
  }

  onCancel(): void {
    this.router.navigate(['/ticket-counters']);
  }
}