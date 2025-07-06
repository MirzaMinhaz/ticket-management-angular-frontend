// src/app/ticket-counters-list/ticket-counters-list.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TicketCounterService } from '../../services/ticket-counter.service';
import { LocationService } from '../../services/location.service'; // To get locations for dropdown
import { TicketCounterDto, CreateTicketCounterDto, LocationDto } from '../../models/common';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-ticket-counters-list',
  standalone: true,
  imports: [
    CommonModule,          // <-- Make sure CommonModule is here
    RouterModule,          // For routerLink
    ReactiveFormsModule    // <-- Make sure ReactiveFormsModule is here for [formGroup]
  ],
  templateUrl: './ticket-counters-list.component.html',
  styleUrls: ['./ticket-counters-list.component.css']
})
export class TicketCountersListComponent implements OnInit {
  ticketCounters: TicketCounterDto[] = [];
  locations: LocationDto[] = []; // Array to hold locations for the dropdown
  ticketCounterForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private ticketCounterService: TicketCounterService,
    private locationService: LocationService, // Inject LocationService
    private fb: FormBuilder
  ) {
    this.ticketCounterForm = this.fb.group({
      locationId: ['', Validators.required], // Required field for location
      counterName: ['', Validators.required],
      counterCode: [''],
      addressDetails: [''],
      contactNumber: [''],
      operatingHours: [''],
      latitude: [null],
      longitude: [null],
      isActive: [true], // Default to true
    });
  }

  ngOnInit(): void {
    this.fetchData(); // Fetch both counters and locations
  }

  fetchData(): void {
    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    // Fetch both ticket counters and locations in parallel using Promise.all
    // This ensures both lists are populated before the component finishes loading
    Promise.all([
      this.ticketCounterService.getAllTicketCounters().pipe(
        catchError(error => {
          this.errorMessage = error.message || 'Failed to fetch ticket counters.';
          console.error('Fetch ticket counters error:', error);
          return of([]);
        })
      ).toPromise(), // Convert Observable to Promise
      this.locationService.getAllLocations().pipe(
        catchError(error => {
          this.errorMessage = this.errorMessage || ''; // Append to existing error if any
          this.errorMessage += (this.errorMessage ? ' And ' : '') + (error.message || 'Failed to fetch locations.');
          console.error('Fetch locations error:', error);
          return of([]);
        })
      ).toPromise()
    ]).then(([counters, locs]) => {
      this.ticketCounters = counters || [];
      this.locations = locs || [];

      // Set default selected locationId if locations are available
      if (this.locations.length > 0 && !this.ticketCounterForm.get('locationId')?.value) {
        this.ticketCounterForm.get('locationId')?.setValue(this.locations[0].locationId);
      }
    }).finally(() => {
      this.loading = false;
    });
  }

  onSubmit(): void {
    if (this.ticketCounterForm.invalid) {
      this.ticketCounterForm.markAllAsTouched();
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    const newTicketCounter: CreateTicketCounterDto = {
      locationId: this.ticketCounterForm.value.locationId,
      counterName: this.ticketCounterForm.value.counterName,
      counterCode: this.ticketCounterForm.value.counterCode || undefined,
      addressDetails: this.ticketCounterForm.value.addressDetails || undefined,
      contactNumber: this.ticketCounterForm.value.contactNumber || undefined,
      operatingHours: this.ticketCounterForm.value.operatingHours || undefined,
    //   latitude: this.ticketCounterForm.value.latitude === null ? undefined : this.ticketCounterForm.value.latitude,
    //   longitude: this.ticketCounterForm.value.longitude === null ? undefined : this.ticketCounterForm.value.longitude,
      isActive: this.ticketCounterForm.value.isActive,
    };

    this.ticketCounterService.createTicketCounter(newTicketCounter).pipe(
      catchError(error => {
        this.errorMessage = error.message || 'Failed to create ticket counter.';
        console.error('Creation error:', error);
        return of(null);
      }),
      finalize(() => this.loading = false)
    ).subscribe(createdCounter => {
      if (createdCounter) {
        this.successMessage = `Ticket Counter "${createdCounter.counterName}" created successfully!`;
        this.ticketCounterForm.reset(); // Reset the form
        // Re-patch initial values like locationId and isActive after reset
        this.ticketCounterForm.patchValue({
          locationId: this.locations.length > 0 ? this.locations[0].locationId : '',
          isActive: true
        });
        this.fetchData(); // Refresh both lists to show the new counter
      }
    });
  }
}