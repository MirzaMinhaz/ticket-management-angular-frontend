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
   Maps lowercase brand keywords → local asset paths.
   Files must exist under src/assets/img/ with the filenames listed below.
   Add more entries (keyword → filename) as you add images.
─────────────────────────────────────────────────────────────────────────── */
const BRAND_LOGOS: Record<string, string> = {
  scania: 'assets/img/scania.jpeg',
  volvo: 'assets/img/volvo.jpeg',
  hino: 'assets/img/hino.jpeg',
  mercedes: 'assets/img/mercedes.jpeg',
  man: 'assets/img/man.jpeg',
  isuzu: 'assets/img/isuzu.jpeg',
  yutong: 'assets/img/yutong.jpeg',
  king: 'assets/img/king.jpeg',
  golden: 'assets/img/golden.jpeg',
  zhongtong: 'assets/img/zhongtong.jpeg',
  daf: 'assets/img/daf.jpeg',
  tata: 'assets/img/tata.jpeg',
  ashok: 'assets/img/ashok.jpeg',
  leyland: 'assets/img/ashok.jpeg',
  eicher: 'assets/img/eicher.jpeg',
  byd: 'assets/img/byd.jpeg',
  neoplan: 'assets/img/neoplan.jpeg',
  setra: 'assets/img/setra.jpeg',
  irizar: 'assets/img/irizar.jpeg',
  hyundai: 'assets/img/hyundai.jpeg',
  br: 'assets/img/br.jpeg',
  caetano: 'assets/img/caetano.jpeg',
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
  selectedOperatorCode: string | null = null;

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
    return this.vehicles.filter((v) => v.type === 'Bus').length;
  }
  get totalTrains(): number {
    return this.vehicles.filter((v) => v.type === 'Train').length;
  }
  get totalAC(): number {
    return this.vehicles.filter((v) => v.acType === 'AC').length;
  }
  get totalCapacity(): number {
    return this.vehicles.reduce((sum, v) => sum + (v.capacity || 0), 0);
  }
  get uniqueOperators(): number {
    return new Set(this.vehicles.map((v) => v.operatorCode).filter(Boolean))
      .size;
  }

  // ─── Brand Logo Helpers ─────────────────────────────────────────────────
  getBrandLogo(model: string): string | null {
    if (!model) return null;
    const lower = model.toLowerCase();
    for (const [key, path] of Object.entries(BRAND_LOGOS)) {
      if (lower.includes(key)) return path;
    }
    return null;
  }

  getBrandName(model: string): string {
    if (!model) return '';
    const lower = model.toLowerCase();
    for (const key of Object.keys(BRAND_LOGOS)) {
      if (lower.includes(key))
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
    return '';
  }

  getBrandInitial(model: string): string {
    return model ? model.charAt(0).toUpperCase() : '?';
  }

  // ─── Operator helpers ───────────────────────────────────────────────────
  getOperatorName(code: string | undefined): string | undefined {
    return this.operators.find((op) => op.operatorCode === code)?.name;
  }

  // ─── Operator filtering (Train → only Bangladesh Railway) ──────────────
  get filteredOperators(): OperatorDto[] {
    if (this.selectedVehicle.type === 'Train') {
      return this.operators.filter((op) =>
        op.name?.toLowerCase().includes('bangladesh railway'),
      );
    }
    return this.operators;
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
    const total = this.totalPages;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const cur = this.currentPage;
    const pages: number[] = [];

    pages.push(1);
    if (cur > 3) pages.push(-1);
    for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) {
      pages.push(p);
    }
    if (cur < total - 2) pages.push(-1);
    pages.push(total);

    return pages;
  }
  goToPage(page: number): void {
    if (page > 0) this.currentPage = page;
  }
  goToNextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }
  goToPreviousPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  // ─── Data loading ────────────────────────────────────────────────────────
  loadOperators(): void {
    this.operatorService.getAll().subscribe({
      next: (data) => (this.operators = data),
      error: (err) => console.error('Failed to load operators', err),
    });
  }
  loadVehicles(): void {
    this.vehicleService.getAll().subscribe({
      next: (data) => (this.vehicles = data),
      error: (err) => console.error('Failed to load vehicles', err),
    });
  }

  // ─── Modal ───────────────────────────────────────────────────────────────
  openModal(vehicle: Vehicle): void {
    this.selectedVehicle = { ...vehicle };
    const matched = this.operators.find(
      (op) => op.operatorCode === vehicle.operatorCode,
    );
    this.selectedOperatorCode = matched?.operatorCode ?? '';
    this.selectedVehicle.acType = vehicle.acType || 'Non AC';
    this.selectedVehicle.busCategory = vehicle.busCategory || 'Single Decker';
    this.selectedVehicle.deckLevel =
      this.selectedVehicle.busCategory === 'Single Decker'
        ? 'Lower Deck'
        : 'Lower Deck / Upper Deck';
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
      error: (err) => console.error('Failed to delete vehicle', err),
    });
  }
  delete(id: number): void {
    this.vehicleService.delete(id).subscribe({
      next: () => this.loadVehicles(),
      error: (err) => console.error('Failed to delete vehicle', err),
    });
  }

  

  // ─── Save (create or update) ──────────────────────────────────────────────
  // ─── Save (create or update) ──────────────────────────────────────────────
save(): void {
  const isBus = this.selectedVehicle.type === 'Bus';

  if (!this.selectedOperatorCode) {
    this.modalSuccessMessage = '';
    console.error('Cannot save vehicle: no operator selected.');
    // If you have a toast/error-message pattern elsewhere (like OperatorComponent),
    // swap this for that instead of console.error — e.g.:
    // this.errorMessage = '⚠️ Please select an operator before saving.';
    return;
  }

  const operatorCode = this.selectedOperatorCode; // now narrowed to `string`

  if (this.selectedVehicle.id > 0) {
    const updateDto: UpdateVehicleDto = {
      operatorCode,
      type: this.selectedVehicle.type,
      model: this.selectedVehicle.model,
      licensePlate: this.selectedVehicle.licensePlate,
      capacity: this.selectedVehicle.capacity,
      isActive: this.selectedVehicle.isActive ?? true,
      acType: isBus ? this.selectedVehicle.acType : null,
      busCategory: isBus ? this.selectedVehicle.busCategory : null,
      deckLevel: isBus ? this.selectedVehicle.deckLevel : null,
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
      error: (err) => console.error('Failed to update vehicle', err),
    });
  } else {
    const createDto: CreateVehicleDto = {
      operatorCode,
      type: this.selectedVehicle.type,
      model: this.selectedVehicle.model,
      licensePlate: this.selectedVehicle.licensePlate,
      capacity: this.selectedVehicle.capacity,
      acType: isBus ? this.selectedVehicle.acType : null,
      busCategory: isBus ? this.selectedVehicle.busCategory : null,
      deckLevel: isBus ? this.selectedVehicle.deckLevel : null,
    };
    this.vehicleService.create(createDto).subscribe({
      next: () => {
        this.successMessage = '✅ Vehicle created successfully!';
        this.loadVehicles();
        this.reset();
        this.autoClearMessage();
      },
      error: (err) => console.error('Failed to create vehicle', err),
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

  onCategoryChange(): void {
    if (this.selectedVehicle.busCategory === 'Single Decker') {
      this.selectedVehicle.deckLevel = 'Lower Deck';
    } else {
      // Double Decker or Sleeper always have both decks
      this.selectedVehicle.deckLevel = 'Lower Deck / Upper Deck';
    }
  }

  onTypeChange(): void {
    if (this.selectedVehicle.type === 'Train') {
      this.selectedVehicle.capacity = 600;
      this.selectedVehicle.acType = '';
      this.selectedVehicle.busCategory = '';
      this.selectedVehicle.deckLevel = '';
      this.setDefaultRailwayOperator();
    } else {
      this.selectedVehicle.capacity = 44;
      this.selectedVehicle.acType = 'AC';
      this.selectedVehicle.busCategory = 'Single Decker';
      this.selectedVehicle.deckLevel = 'Lower Deck';
    }
  }

  // ─── Default operator for Train type ───────────────────────────────────
  private setDefaultRailwayOperator(): void {
  const railway = this.operators.find((op) =>
    op.name?.toLowerCase().includes('bangladesh railway'),
  );
  if (railway) {
    this.selectedOperatorCode = railway.operatorCode;
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
