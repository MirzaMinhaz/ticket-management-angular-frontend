// src/app/features/ticket-counters/components/ticket-counter-entry/ticket-counter-entry.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { LocationService } from '../../services/location.service'; // Adjust path
import { TicketCounterDto, CreateTicketCounterDto, UpdateTicketCounterDto, LocationDto } from '../../models/common'; // Adjust path
import { catchError, finalize } from 'rxjs/operators';
import { of, forkJoin } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-ticket-counter-entry',
  standalone: true,
  imports: [
    CommonModule,          // <-- Make sure CommonModule is here
    ReactiveFormsModule,   // <-- Make sure ReactiveFormsModule is here for [formGroup]
    RouterModule           // For routerLink
  ],
  templateUrl: './ticket-counter-entry.component.html',
  styleUrls: ['./ticket-counter-entry.component.css']
})
export class TicketCounterEntryComponent implements OnInit {
  ticketCounterForm: FormGroup;
  locations: LocationDto[] = [];
  isEditMode = false;
  ticketCounterId: string | null = null;
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private ticketCounterService: TicketCounterService,
    private locationService: LocationService,
    private route: ActivatedRoute, // To get route parameters (like 'id' for edit)
    private router: Router // To navigate after save
  ) {
    this.ticketCounterForm = this.fb.group({
      locationId: ['', Validators.required],
      counterName: ['', Validators.required],
      counterCode: [''],
      addressDetails: [''],
      contactNumber: [''],
      operatingHours: [''],
      latitude: [null],
      longitude: [null],
      isActive: [true] // Default for new entry
    });
  }

  ngOnInit(): void {
    this.ticketCounterId = this.route.snapshot.paramMap.get('id'); // Get ID from route for edit mode

    // Fetch locations first, then fetch ticket counter if in edit mode
    this.loading = true;
    this.errorMessage = null;

    this.locationService.getAllLocations().pipe(
      catchError(error => {
        this.errorMessage = 'Failed to load locations: ' + (error.message || 'Unknown error');
        console.error('Error fetching locations:', error);
        return of([]); // Return empty array to allow component to load
      }),
      finalize(() => {
        // If no locations, disable locationId select to prevent form submission issues
        if (this.locations.length === 0) {
          this.ticketCounterForm.get('locationId')?.disable();
        }
        if (!this.isEditMode) {
            this.loading = false; // Only set loading to false here if not in edit mode
        }
      })
    ).subscribe(locations => {
      this.locations = locations;
      // If there are locations, pre-select the first one if it's a new entry
      if (!this.isEditMode && this.locations.length > 0) {
        this.ticketCounterForm.get('locationId')?.setValue(this.locations[0].locationId);
      }

      if (this.ticketCounterId) {
        this.isEditMode = true;
        this.loadTicketCounterForEdit(this.ticketCounterId);
      } else {
        this.loading = false; // If not in edit mode, loading stops here
      }
    });
  }

  loadTicketCounterForEdit(id: string): void {
    this.loading = true;
    this.ticketCounterService.getTicketCounterById(id).pipe(
      catchError(error => {
        this.errorMessage = 'Failed to load ticket counter for edit: ' + (error.message || 'Unknown error');
        console.error('Error fetching ticket counter for edit:', error);
        this.router.navigate(['/ticket-counters']); // Redirect to list if not found
        return of(null);
      }),
      finalize(() => this.loading = false)
    ).subscribe(counter => {
      if (counter) {
        this.ticketCounterForm.patchValue({
          locationId: counter.locationId,
          counterName: counter.counterName,
          counterCode: counter.counterCode,
          addressDetails: counter.addressDetails,
          contactNumber: counter.contactNumber,
          operatingHours: counter.operatingHours,
        //   latitude: counter.latitude,
        //   longitude: counter.longitude,
          isActive: counter.isActive
        });
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

    const formValue = this.ticketCounterForm.value;

    if (this.isEditMode && this.ticketCounterId) {
      const updateDto: UpdateTicketCounterDto = {
        counterName: formValue.counterName,
        counterCode: formValue.counterCode || undefined,
        addressDetails: formValue.addressDetails || undefined,
        contactNumber: formValue.contactNumber || undefined,
        operatingHours: formValue.operatingHours || undefined,
        // latitude: formValue.latitude === null ? undefined : formValue.latitude,
        // longitude: formValue.longitude === null ? undefined : formValue.longitude,
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
        if (result !== null) { // Check if update was successful (no error occurred)
          this.successMessage = 'Ticket Counter updated successfully!';
          // Optionally navigate back to the list after a delay
          setTimeout(() => this.router.navigate(['/ticket-counters']), 2000);
        }
      });
    } else {
      const createDto: CreateTicketCounterDto = {
        locationId: formValue.locationId,
        counterName: formValue.counterName,
        counterCode: formValue.counterCode || undefined,
        addressDetails: formValue.addressDetails || undefined,
        contactNumber: formValue.contactNumber || undefined,
        operatingHours: formValue.operatingHours || undefined,
        // latitude: formValue.latitude === null ? undefined : formValue.latitude,
        // longitude: formValue.longitude === null ? undefined : formValue.longitude,
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
          // Reset select to first option and checkbox to true
          if (this.locations.length > 0) {
            this.ticketCounterForm.get('locationId')?.setValue(this.locations[0].locationId);
          }
          this.ticketCounterForm.get('isActive')?.setValue(true);

          // Optionally navigate to edit page for new entry, or back to list
          // setTimeout(() => this.router.navigate(['/ticket-counters', 'edit', createdCounter.ticketCounterId]), 2000);
        }
      });
    }
  }

  // Helper to check if a form control is invalid and touched
  isFieldInvalid(fieldName: string): boolean {
    const control = this.ticketCounterForm.get(fieldName);
    return control ? control.invalid && control.touched : false;
  }

  onCancel(): void {
    this.router.navigate(['/ticket-counters']); // Navigate back to the list
  }
}