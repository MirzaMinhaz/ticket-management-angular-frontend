import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  AsyncValidatorFn,
  ValidationErrors
} from '@angular/forms';
import { LocationService } from '../../services/location.service';
import { LocationDto, CreateLocationDto } from '../../models/common';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  switchMap,
} from 'rxjs/operators';
import { of, Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

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
      name: ['', {
        validators: [Validators.required],
        asyncValidators: [this.locationExistsTogetherValidator()],
        updateOn: 'blur'
      }],
      type: ['City', Validators.required],
      address: [''],
    });
  }

  ngOnInit(): void {
    this.fetchLocations();
    this.setupAddressAutoPopulation();
  }

  locationExistsTogetherValidator(): AsyncValidatorFn {
    let lastValidatedKey = '';

    return (control: AbstractControl): Observable<ValidationErrors | null> => {
      if (!this.locationForm) return of(null);

      const name = this.locationForm.get('name')?.value;
      const type = this.locationForm.get('type')?.value;

      if (!name || !type) return of(null);

      const currentKey = `${name}|${type}`;
      if (currentKey === lastValidatedKey) return of(null);

      return of({ name, type }).pipe(
        debounceTime(400),
        distinctUntilChanged((prev, curr) => prev.name === curr.name && prev.type === curr.type),
        switchMap(val =>
          this.locationService.checkLocationExists(val.name, val.type).pipe(
            map(exists => {
              if (exists) {
                return { duplicateLocation: true };
              } else {
                lastValidatedKey = currentKey;
                return null;
              }
            }),
            catchError(err => {
              console.error('Validation error:', err);
              return of(null); // Fail-open
            })
          )
        )
      );
    };
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
    map(data => data.map(loc => ({
      ...loc,
      locationId: Number(loc.locationId) // convert string to number
    }))),
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
    this.locationForm.markAllAsTouched();
    this.locationForm.updateValueAndValidity({ emitEvent: true });

    if (this.locationForm.pending) {
      this.toastr.info('Please wait, checking for duplicate location...', 'Validation Pending');
      return;
    }

    if (this.locationForm.invalid) {
      if (this.locationForm.get('name')?.hasError('duplicateLocation')) {
        this.toastr.error('A location with this Name and Type already exists.', 'Duplicate Entry');
      } else {
        this.toastr.warning('Please fill in all required fields and ensure valid inputs.', 'Validation Error');
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
