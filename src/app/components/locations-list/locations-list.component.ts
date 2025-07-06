// src/app/locations-list/locations-list.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LocationService } from '../../services/location.service';
import { LocationDto, CreateLocationDto } from '../../models/common';
import { catchError, finalize } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { of } from 'rxjs';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-locations-list',
  standalone: true,
  imports: [
    CommonModule,         // <-- Make sure CommonModule is here
    ReactiveFormsModule,  // <-- Make sure ReactiveFormsModule is here for [formGroup]
    RouterModule          // For routerLink
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.css']
})
export class LocationsListComponent implements OnInit {
  locations: LocationDto[] = [];
  locationForm: FormGroup;
  loading = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private locationService: LocationService,
    private fb: FormBuilder
  ) {
    // Initialize the form with Reactive Forms
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      type: ['', Validators.required],
      address: [''],
    //   latitude: [null],
    //   longitude: [null],
    });
  }

  ngOnInit(): void {
    this.fetchLocations(); // Fetch locations when the component initializes
  }

  fetchLocations(): void {
    this.loading = true;
    this.errorMessage = null; // Clear previous errors
    this.successMessage = null; // Clear previous success messages
    this.locationService.getAllLocations().pipe(
      catchError(error => {
        this.errorMessage = error.message || 'Failed to fetch locations.';
        console.error('Fetch error:', error);
        return of([]); // Return an empty array to continue the observable stream
      }),
      finalize(() => this.loading = false) // Always set loading to false when observable completes
    ).subscribe(data => {
      this.locations = data;
    });
  }

  onSubmit(): void {
    if (this.locationForm.invalid) {
      this.locationForm.markAllAsTouched(); // Mark fields as touched to show validation errors
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    this.loading = true;
    this.errorMessage = null;
    this.successMessage = null;

    // Create the DTO from form values
    const newLocation: CreateLocationDto = {
      name: this.locationForm.value.name,
      type: this.locationForm.value.type,
      address: this.locationForm.value.address || undefined, // Send undefined if empty string
    //   latitude: this.locationForm.value.latitude === null ? undefined : this.locationForm.value.latitude,
    //   longitude: this.locationForm.value.longitude === null ? undefined : this.locationForm.value.longitude,
    };

    this.locationService.createLocation(newLocation).pipe(
      catchError(error => {
        this.errorMessage = error.message || 'Failed to create location.';
        console.error('Creation error:', error);
        return of(null); // Return null to continue without success
      }),
      finalize(() => this.loading = false)
    ).subscribe(createdLocation => {
      if (createdLocation) {
        this.successMessage = `Location "${createdLocation.name}" created successfully!`;
        this.locationForm.reset(); // Reset form fields
        // Explicitly set values to null/empty after reset to ensure clean state
        this.locationForm.patchValue({
            name: '', type: '', address: ''
            // latitude: null, longitude: null
        });
        this.fetchLocations(); // Refresh the list to show the new item
      }
    });
  }
}