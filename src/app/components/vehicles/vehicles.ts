import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle, CreateVehicleDto, UpdateVehicleDto } from '../../models/common';
import { NgZone } from '@angular/core';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicles.html',
  styleUrls: ['./vehicles.css']
})
export class VehicleComponent implements OnInit {
  vehicles: Vehicle[] = [];
  selectedVehicle: Vehicle = this.getEmptyVehicle();
  successMessage: string = '';

  showModal: boolean = false;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: string = '';
  sortAsc: boolean = true;

  constructor(private vehicleService: VehicleService, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.onTypeChange();
  }

  get paginatedVehicles(): Vehicle[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.vehicles.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.vehicles.length / this.itemsPerPage);
  }

  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: data => this.vehicles = data,
      error: err => console.error('Failed to load vehicles', err)
    });
  }

  openModal(vehicle: Vehicle): void {
    this.selectedVehicle = { ...vehicle };
    this.onTypeChange();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  save(): void {
    if (this.selectedVehicle.id > 0) {
      const updateDto: UpdateVehicleDto = {
        operatorId: this.selectedVehicle.operatorId ?? 0,
        type: this.selectedVehicle.type,
        model: this.selectedVehicle.model,
        licensePlate: this.selectedVehicle.licensePlate,
        capacity: this.selectedVehicle.capacity,
        isActive: this.selectedVehicle.isActive ?? true
      };

      this.vehicleService.update(this.selectedVehicle.id, updateDto).subscribe({
        next: () => {
          this.successMessage = '✅ Vehicle updated successfully!';
          this.loadVehicles();
          this.closeModal();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to update vehicle', err)
      });
    } else {
      const createDto: CreateVehicleDto = {
        type: this.selectedVehicle.type,
        model: this.selectedVehicle.model,
        licensePlate: this.selectedVehicle.licensePlate,
        capacity: this.selectedVehicle.capacity
      };

      this.vehicleService.create(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Vehicle created successfully!';
          this.loadVehicles();
          this.reset();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to create vehicle', err)
      });
    }
  }

  delete(id: number): void {
    this.vehicleService.delete(id).subscribe({
      next: () => this.loadVehicles(),
      error: err => console.error('Failed to delete vehicle', err)
    });
  }

  reset(): void {
    this.selectedVehicle = this.getEmptyVehicle();
    this.onTypeChange();
  }

  getEmptyVehicle(): Vehicle {
    return {
      id: 0,
      type: 'Bus',
      model: '',
      licensePlate: '',
      capacity: 44,
      vehicleCode: '',
      operatorId: undefined,
      createdAt: '',
      lastModifiedAt: '',
      isActive: true
    };
  }

  onTypeChange(): void {
    this.selectedVehicle.capacity = this.selectedVehicle.type === 'Train' ? 600 : 44;
  }

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3000);
  }

  goToNextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  goToPreviousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  get pages(): number[] {
  return Array.from({ length: this.totalPages }, (_, i) => i + 1);
}

goToPage(page: number): void {
  this.currentPage = page;
}


  sortBy(field: keyof Vehicle): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }

    this.vehicles.sort((a, b) => {
      const valA = a[field]?.toString().toLowerCase() ?? '';
      const valB = b[field]?.toString().toLowerCase() ?? '';
      return this.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
  }
}
