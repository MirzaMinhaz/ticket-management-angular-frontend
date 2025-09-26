// src/app/components/vehicles/vehicles.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../services/vehicle.service';
import { Vehicle, CreateVehicleDto, UpdateVehicleDto } from '../../models/common';

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicles.html',
  styleUrls: ['./vehicles.css']
})
export class VehicleComponent implements OnInit {
  vehicles: Vehicle[] = [];

  selectedVehicle: Vehicle = {
    id: 0,
    type: 'Bus', // ✅ string type
    model: '',
    licensePlate: '',
    capacity: 44,
    vehicleCode: '',
    operatorId: undefined,
    createdAt: '',
    lastModifiedAt: '',
    isActive: true
  };

  constructor(private vehicleService: VehicleService) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.onTypeChange();
  }

  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: data => this.vehicles = data,
      error: (err: any) => console.error('Failed to load vehicles', err)
    });
  }

  select(vehicle: Vehicle): void {
    this.selectedVehicle = { ...vehicle };
    this.onTypeChange();
  }

  save(): void {
  console.log('🚀 Save triggered:', this.selectedVehicle);
  if (this.selectedVehicle.id > 0) {
    console.log('✏️ Updating vehicle:', this.selectedVehicle.id);
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
        this.loadVehicles();
        this.reset(); // ✅ move inside success block
      },
      error: (err: any) => console.error('Failed to update vehicle', err)
    });
  } else {
    console.log('🆕 Creating vehicle:', this.selectedVehicle);
    const createDto: CreateVehicleDto = {
      type: this.selectedVehicle.type,
      model: this.selectedVehicle.model,
      licensePlate: this.selectedVehicle.licensePlate,
      capacity: this.selectedVehicle.capacity
    };

    this.vehicleService.create(createDto).subscribe({
      next: () => {
        this.loadVehicles();
        this.reset(); // ✅ move inside success block
      },
      error: (err: any) => console.error('Failed to create vehicle', err)
    });
  }
    this.reset();
  }

  delete(id: number): void {
    this.vehicleService.delete(id).subscribe({
      next: () => this.loadVehicles(),
      error: (err: any) => console.error('Failed to delete vehicle', err)
    });
  }

  reset(): void {
    this.selectedVehicle = {
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
    this.onTypeChange();
  }

  onTypeChange(): void {
    if (this.selectedVehicle.type === 'Bus') {
      this.selectedVehicle.capacity = 44;
    } else if (this.selectedVehicle.type === 'Train') {
      this.selectedVehicle.capacity = 600;
    }
  }
}