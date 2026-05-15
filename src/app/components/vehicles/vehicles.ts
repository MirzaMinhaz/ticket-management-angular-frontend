import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VehicleService } from '../../services/vehicle.service';
import {
  Vehicle,
  CreateVehicleDto,
  UpdateVehicleDto,
} from '../../models/common';
import { NgZone } from '@angular/core';
import { OperatorService } from '../../services/operators.service';
import { OperatorDto } from '../../models/common';
import { Router } from '@angular/router';

/* ─── Brand logo map ───────────────────────────────────────────────────────
   Maps lowercase brand keywords → publicly hosted SVG/PNG logo URLs.
   We use brand logo APIs (logo.clearbit.com for generic fallback,
   and Wikipedia SVG URLs for bus/transport brands).
   Add more entries as needed.
─────────────────────────────────────────────────────────────────────────── */
const BRAND_LOGOS: Record<string, string> = {
  scania:    'https://upload.wikimedia.org/wikipedia/commons/9/98/Scania_logo.svg',
  volvo:     'https://upload.wikimedia.org/wikipedia/commons/4/44/Volvo_logo.svg',
  hino:      'https://upload.wikimedia.org/wikipedia/commons/4/4e/Hino_Motors_logo.svg',
  mercedes:  'https://upload.wikimedia.org/wikipedia/commons/9/90/Mercedes-Logo.svg',
  man:       'https://upload.wikimedia.org/wikipedia/commons/8/8e/MAN_truck_logo.svg',
  isuzu:     'https://upload.wikimedia.org/wikipedia/commons/a/a2/Isuzu_logo.svg',
  yutong:    'https://upload.wikimedia.org/wikipedia/commons/7/79/Yutong_logo.svg',
  king:      'https://upload.wikimedia.org/wikipedia/commons/4/4d/King_Long_logo.svg',
  golden:    'https://upload.wikimedia.org/wikipedia/commons/7/72/Golden_Dragon_Bus_logo.svg',
  zhongtong: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Zhongtong_Bus_logo.svg',
  daf:       'https://upload.wikimedia.org/wikipedia/commons/d/d4/DAF_logo.svg',
  tata:      'https://upload.wikimedia.org/wikipedia/commons/8/8e/Tata_logo.svg',
  ashok:     'https://upload.wikimedia.org/wikipedia/commons/5/56/Ashok_Leyland_logo.svg',
  leyland:   'https://upload.wikimedia.org/wikipedia/commons/5/56/Ashok_Leyland_logo.svg',
  eicher:    'https://upload.wikimedia.org/wikipedia/commons/9/99/Eicher_Motors_Logo.svg',
  byd:       'https://upload.wikimedia.org/wikipedia/commons/b/b3/BYD_Auto_logo.svg',
  neoplan:   'https://upload.wikimedia.org/wikipedia/commons/6/6e/Neoplan_Logo.svg',
  setra:     'https://upload.wikimedia.org/wikipedia/commons/e/ef/Setra_Logo.svg',
  irizar:    'https://upload.wikimedia.org/wikipedia/commons/8/89/Irizar_logo.svg',
  caetano:   'https://upload.wikimedia.org/wikipedia/commons/5/57/Caetanobus_logo.svg',
};

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicles.html',
  styleUrls: ['./vehicles.css'],
  encapsulation: ViewEncapsulation.None,
})
export class VehicleComponent implements OnInit {
  vehicles: Vehicle[] = [];
  selectedVehicle: Vehicle = this.getEmptyVehicle();
  successMessage: string = '';
  modalSuccessMessage: string = '';

  showModal: boolean = false;
  showDeleteConfirmModal: boolean = false;
  vehicleToDelete: Vehicle | null = null;

  currentPage: number = 1;
  itemsPerPage: number = 10;
  sortField: string = '';
  sortAsc: boolean = true;

  operators: OperatorDto[] = [];
  selectedOperatorCode: string = '';

  constructor(
    private vehicleService: VehicleService,
    private operatorService: OperatorService,
    private ngZone: NgZone,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
    this.loadOperators();
    this.onTypeChange();
  }

  // ─── Stats ──────────────────────────────────────────────────────────────
  get totalBuses(): number {
    return this.vehicles.filter(v => v.type === 'Bus').length;
  }
  get totalTrains(): number {
    return this.vehicles.filter(v => v.type === 'Train').length;
  }
  get totalAC(): number {
    return this.vehicles.filter(v => v.acType === 'AC').length;
  }
  get totalCapacity(): number {
    return this.vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
  }
  get uniqueOperators(): number {
    return new Set(this.vehicles.map(v => v.operatorCode).filter(Boolean)).size;
  }

  // ─── Brand Logo Helpers ─────────────────────────────────────────────────
  getBrandLogo(model: string): string | null {
    if (!model) return null;
    const lower = model.toLowerCase();
    for (const [key, url] of Object.entries(BRAND_LOGOS)) {
      if (lower.includes(key)) return url;
    }
    return null;
  }

  getBrandName(model: string): string {
    if (!model) return '';
    const lower = model.toLowerCase();
    for (const key of Object.keys(BRAND_LOGOS)) {
      if (lower.includes(key)) return key.charAt(0).toUpperCase() + key.slice(1);
    }
    return '';
  }

  getBrandInitial(model: string): string {
    return model ? model.charAt(0).toUpperCase() : '?';
  }

  // ─── Operator helpers ───────────────────────────────────────────────────
  getOperatorName(code: string | undefined): string | undefined {
    return this.operators.find(op => op.operatorCode === code)?.name;
  }

  // ─── Pagination ─────────────────────────────────────────────────────────
  get paginatedVehicles(): Vehicle[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.vehicles.slice(start, start + this.itemsPerPage);
  }
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.vehicles.length / this.itemsPerPage));
  }
  get pages(): number[] {
    // Show max 7 pages with ellipsis logic handled in template
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const cur = this.currentPage;
    const pages: number[] = [];

    pages.push(1);
    if (cur > 3) pages.push(-1); // ellipsis
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) {
      pages.push(p);
    }
    if (cur < total - 2) pages.push(-1); // ellipsis
    pages.push(total);

    return pages;
  }
  goToPage(page: number): void { if (page > 0) this.currentPage = page; }
  goToNextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPreviousPage(): void { if (this.currentPage > 1) this.currentPage--; }

  // ─── Data loading ────────────────────────────────────────────────────────
  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: data => (this.operators = data),
      error: err => console.error('Failed to load operators', err),
    });
  }
  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: data => (this.vehicles = data),
      error: err => console.error('Failed to load vehicles', err),
    });
  }

  // ─── Modal ───────────────────────────────────────────────────────────────
  openModal(vehicle: Vehicle): void {
    this.selectedVehicle = { ...vehicle };
    const matched = this.operators.find(op => op.operatorCode === vehicle.operatorCode);
    this.selectedOperatorCode = matched?.operatorCode ?? '';
    this.selectedVehicle.acType      = vehicle.acType      || 'Non AC';
    this.selectedVehicle.busCategory = vehicle.busCategory || 'Single Decker';
    this.selectedVehicle.deckLevel   = vehicle.deckLevel   || 'Lower Deck';
    this.modalSuccessMessage = '';
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.reset();
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  confirmDelete(vehicle: Vehicle): void {
    this.vehicleToDelete = vehicle;
    this.showDeleteConfirmModal = true;
  }
  cancelDelete(): void {
    this.vehicleToDelete = null;
    this.showDeleteConfirmModal = false;
  }
  deleteConfirmed(): void {
    if (!this.vehicleToDelete) return;
    this.vehicleService.delete(this.vehicleToDelete.id).subscribe({
      next: () => {
        this.loadVehicles();
        this.showDeleteConfirmModal = false;
        this.vehicleToDelete = null;
        this.successMessage = '🗑️ Vehicle deleted successfully!';
        this.autoClearMessage();
      },
      error: err => console.error('Failed to delete vehicle', err),
    });
  }
  delete(id: number): void {
    this.vehicleService.delete(id).subscribe({
      next: () => this.loadVehicles(),
      error: err => console.error('Failed to delete vehicle', err),
    });
  }

  // ─── Save (create or update) ────────────────────────────────────────────── save part
  save(): void {
    if (this.selectedVehicle.id > 0) {
      const updateDto: UpdateVehicleDto = {
        operatorCode: this.selectedOperatorCode,
        type:         this.selectedVehicle.type,
        model:        this.selectedVehicle.model,
        licensePlate: this.selectedVehicle.licensePlate,
        capacity:     this.selectedVehicle.capacity,
        isActive:     this.selectedVehicle.isActive ?? true,
        acType:       this.selectedVehicle.acType,
        busCategory:  this.selectedVehicle.busCategory,
        deckLevel:    this.selectedVehicle.deckLevel,
      };
      this.vehicleService.update(this.selectedVehicle.id, updateDto).subscribe({
        next: () => {
          this.modalSuccessMessage = '✅ Vehicle updated successfully!';
          this.loadVehicles();
          setTimeout(() => {
            this.ngZone.run(() => {
              this.closeModal();
              this.modalSuccessMessage = '';
            });
          }, 2000);
        },
        error: err => console.error('Failed to update vehicle', err),
      });
    } else {
      const createDto: CreateVehicleDto = {
        operatorCode: this.selectedOperatorCode,
        type:         this.selectedVehicle.type,
        model:        this.selectedVehicle.model,
        licensePlate: this.selectedVehicle.licensePlate,
        capacity:     this.selectedVehicle.capacity,
        acType:       this.selectedVehicle.acType,
        busCategory:  this.selectedVehicle.busCategory,
        deckLevel:    this.selectedVehicle.deckLevel,
      };
      this.vehicleService.create(createDto).subscribe({
        next: () => {
          this.successMessage = '✅ Vehicle created successfully!';
          this.loadVehicles();
          this.reset();
          this.autoClearMessage();
        },
        error: err => console.error('Failed to create vehicle', err),
      });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  reset(): void {
    this.selectedVehicle = this.getEmptyVehicle();
    this.selectedOperatorCode = '';
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
      acType: 'Non AC',
      busCategory: 'Single Decker',
      deckLevel: 'Lower Deck',
      operatorId: undefined,
      createdAt: '',
      lastModifiedAt: '',
      isActive: true,
    };
  }

  onTypeChange(): void {
    if (this.selectedVehicle.type === 'Train') {
      this.selectedVehicle.capacity    = 600;
      this.selectedVehicle.acType      = '';
      this.selectedVehicle.busCategory = '';
      this.selectedVehicle.deckLevel   = '';
    } else {
      this.selectedVehicle.capacity    = 44;
      this.selectedVehicle.acType      = 'AC';
      this.selectedVehicle.busCategory = 'Single Decker';
      this.selectedVehicle.deckLevel   = 'Lower Deck';
    }
  }

  autoClearMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.successMessage = '';
      });
    }, 3500);
  }

  autoClearModalMessage(): void {
    setTimeout(() => {
      this.ngZone.run(() => {
        this.modalSuccessMessage = '';
      });
    }, 3000);
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