// src/app/components/locations-list/locations-list.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, AsyncValidatorFn, ValidationErrors } from '@angular/forms';
import { LocationService } from '../../services/location.service';
import { LocationDto, CreateLocationDto } from '../../models/common';
// ADDED combineLatest
import { catchError, finalize, map, switchMap } from 'rxjs/operators'; // <--- Added switchMap
import { CommonModule } from '@angular/common';
import { of, Observable, combineLatest } from 'rxjs'; // <--- Added combineLatest
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-locations-list',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule
  ],
  templateUrl: './locations-list.component.html',
  styleUrls: ['./locations-list.component.css']
})
export class LocationsListComponent implements OnInit {
  locations: LocationDto[] = [];
  locationForm: FormGroup;
  loading = false;

  constructor(
    private locationService: LocationService,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {
    this.locationForm = this.fb.group({
      name: ['', Validators.required],
      type: ['City', Validators.required],
      address: [''],
    }, {
      asyncValidators: [this.locationExistsTogetherValidator()],
      updateOn: 'blur' // Validate on blur for better UX
    });
  }

  ngOnInit(): void {
    this.fetchLocations();
    this.setupAddressAutoPopulation();
  }

  // MODIFIED ASYNC VALIDATOR: Checks for duplicate location (name + type)
  locationExistsTogetherValidator(): AsyncValidatorFn {
    return (group: AbstractControl): Observable<ValidationErrors | null> => {
      const nameControl = group.get('name');
      const typeControl = group.get('type');

      // If controls are not initialized or missing, return null
      if (!nameControl || !typeControl) {
        return of(null);
      }

      // Use combineLatest to react to changes in both name and type
      return combineLatest([nameControl.valueChanges, typeControl.valueChanges]).pipe(
        debounceTime(500), // Wait for 500ms after the last change on either field
        distinctUntilChanged((
          [prevName, prevType],
          [currName, currType]
        ) => prevName === currName && prevType === currType), // Only emit if the combination of name and type changes
        switchMap(([name, type]) => {
          // If name or type is empty, no need to call API, clear errors
          if (!name || !type) {
            this.clearDuplicateErrors(nameControl, typeControl);
            return of(null);
          }
          // Make the API call
          return this.locationService.checkLocationExists(name, type).pipe(
            map(exists => {
              if (exists) {
                // Set error on both controls and the form group
                nameControl.setErrors({ ...nameControl.errors, duplicateLocation: true });
                typeControl.setErrors({ ...typeControl.errors, duplicateLocation: true });
                return { duplicateLocation: true };
              } else {
                // Clear the duplicate error if it was set
                this.clearDuplicateErrors(nameControl, typeControl);
                return null;
              }
            }),
            catchError((error) => {
              console.error('Error checking duplicate location:', error);
              this.toastr.error('Failed to verify location existence. Please try again.', 'Validation Error');
              this.clearDuplicateErrors(nameControl, typeControl); // Clear any old errors
              return of(null); // Allow submission if API call itself fails
            })
          );
        })
      );
    };
  }

  private clearDuplicateErrors(nameControl: AbstractControl | null, typeControl: AbstractControl | null): void {
    if (nameControl && nameControl.hasError('duplicateLocation')) {
      const errors = { ...nameControl.errors }; // Create a new object to modify
      delete errors['duplicateLocation'];
      // Set errors to null if no other errors remain, otherwise set the remaining errors
      nameControl.setErrors(Object.keys(errors).length ? errors : null);
    }
    if (typeControl && typeControl.hasError('duplicateLocation')) {
      const errors = { ...typeControl.errors }; // Create a new object to modify
      delete errors['duplicateLocation'];
      typeControl.setErrors(Object.keys(errors).length ? errors : null);
    }
    // Also clear the error from the form group itself if all sub-errors are clear
    if (this.locationForm.hasError('duplicateLocation')) {
        const formErrors = { ...this.locationForm.errors };
        delete formErrors['duplicateLocation'];
        this.locationForm.setErrors(Object.keys(formErrors).length ? formErrors : null);
    }
  }


  setupAddressAutoPopulation(): void {
    this.locationForm.get('name')?.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(name => {
      if (name) {
        this.locationForm.get('address')?.setValue(`${name}, Bangladesh`);
      } else {
        this.locationForm.get('address')?.setValue('');
      }
    });
  }

  fetchLocations(): void {
    this.loading = true;
    this.locationService.getAllLocations().pipe(
      catchError(error => {
        this.toastr.error(error.message || 'Failed to fetch locations.', 'Error');
        console.error('Fetch error:', error);
        return of([]);
      }),
      finalize(() => this.loading = false)
    ).subscribe(data => {
      this.locations = data;
    });
  }

  onSubmit(): void {
    if (this.locationForm.invalid || this.locationForm.pending) {
      this.locationForm.markAllAsTouched();
      if (this.locationForm.pending) {
        this.toastr.info('Please wait, checking for duplicate location...', 'Validation Pending');
      } else if (this.locationForm.hasError('duplicateLocation')) {
        this.toastr.error('A location with this Name and Type already exists.', 'Duplicate Entry');
      } else {
        this.toastr.warning('Please fill in all required fields.', 'Validation Error');
      }
      return;
    }

    this.loading = true;

    const newLocation: CreateLocationDto = {
      name: this.locationForm.value.name,
      type: this.locationForm.value.type,
      address: this.locationForm.value.address || undefined,
    };

    this.locationService.createLocation(newLocation).pipe(
      catchError(error => {
        this.toastr.error(error.message || 'Failed to create location.', 'Creation Failed');
        console.error('Creation error:', error);
        return of(null);
      }),
      finalize(() => this.loading = false)
    ).subscribe(createdLocation => {
      if (createdLocation) {
        this.toastr.success(`Location "${createdLocation.name}" created successfully!`, 'Success');
        this.locationForm.reset();
        this.locationForm.patchValue({
          name: '',
          type: 'City',
          address: ''
        });
        this.fetchLocations();
      }
    });
  }
}