import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { SeatService } from '../../services/seat.service';
import { VehicleService } from '../../services/vehicle.service';
import { SeatDto, Vehicle } from '../../models/common';

@Component({
  selector: 'app-seat-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './seat-booking.component.html',
  styleUrls: ['./seat-booking.component.css']
})
export class SeatBookingComponent implements OnInit {
  seats: SeatDto[] = [];
  selectedSeats: SeatDto[] = [];
  selectedBusId: number = 0;
  vehicle: Vehicle | null = null;

  rows: string[] = [];         // row letters in order ['A','B','C',...]
  leftCols: number[] = [1, 2];
  rightCols: number[] = [3, 4];

  oddCapacity: boolean = false;

  constructor(
    private seatService: SeatService,
    private vehicleService: VehicleService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const vehicleId = +params['vehicleId'];
      if (!vehicleId) return;

      this.selectedBusId = vehicleId;

      this.vehicleService.getById(vehicleId).subscribe(v => {
        this.vehicle = v;
        const capacity = v.capacity ?? 40;
        this.oddCapacity = capacity % 2 !== 0;
        this.loadSeatsByVehicle(vehicleId, capacity);
      });
    });
  }

  private loadSeatsByVehicle(vehicleId: number, capacity: number): void {
    this.seatService.getSeatsBySchedule(vehicleId).subscribe({
      next: (seats) => {
        if (seats && seats.length) {
          this.seats = seats.map(s => ({
            ...s,
            status: s.isBooked ? 'reserved' : 'available'
          }));
        } else {
          this.seats = this.generateSeatsByCapacity(capacity);
        }
        this.normalizeAndPrepareLayout();
        this.selectedSeats = [];
      },
      error: () => {
        this.seats = this.generateSeatsByCapacity(capacity);
        this.normalizeAndPrepareLayout();
        this.selectedSeats = [];
      }
    });
  }

  /**
   * Generate seats sequentially by rows (A, B, C...) and 4 columns per row.
   * If capacity is odd: remove A1.
   * Then ensure the last row has all 4 columns (fill missing columns).
   */
  private generateSeatsByCapacity(capacity: number): SeatDto[] {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

    // create seats by rows with up to 4 seats per row
    for (let r = 0; count < capacity && r < alphabet.length; r++) {
      const row = alphabet[r];
      for (let c = 1; c <= 4 && count < capacity; c++) {
        count++;
        seats.push({
          id: count,
          seatNumber: `${row}${c}`,
          seatCode: `${row}${c}`,
          isBooked: false,
          status: 'available'
        });
      }
    }

    // If odd capacity, remove A1 (first column first row)
    if (capacity % 2 !== 0) {
      const idx = seats.findIndex(s => s.seatNumber === 'A1');
      if (idx !== -1) seats.splice(idx, 1);
    }

    // Ensure last row has all 4 columns
    if (seats.length) {
      const lastRowLetter = seats[seats.length - 1].seatNumber.charAt(0);
      const lastRowSeats = seats.filter(s => s.seatNumber.charAt(0) === lastRowLetter);
      const existingCols = lastRowSeats.map(s => parseInt(s.seatNumber.substring(1), 10));
      for (let c = 1; c <= 4; c++) {
        if (!existingCols.includes(c)) {
          seats.push({
            id: ++count,
            seatNumber: `${lastRowLetter}${c}`,
            seatCode: `${lastRowLetter}${c}`,
            isBooked: false,
            status: 'available'
          });
        }
      }
    }

    return seats;
  }

  /** Normalize seat ordering and prepare rows array */
  private normalizeAndPrepareLayout(): void {
    // sort seats by row letter (A..Z) then by column (1..4)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    this.seats.sort((a, b) => {
      const ra = a.seatNumber.charAt(0);
      const rb = b.seatNumber.charAt(0);
      const ia = alphabet.indexOf(ra);
      const ib = alphabet.indexOf(rb);
      if (ia !== ib) return ia - ib;
      const ca = parseInt(a.seatNumber.substring(1), 10);
      const cb = parseInt(b.seatNumber.substring(1), 10);
      return ca - cb;
    });

    // Build ordered unique rows
    this.rows = [...new Set(this.seats.map(s => s.seatNumber.charAt(0)))];

    // If oddCapacity and A row lost A1 entirely (possible if capacity small),
    // ensure A still exists only if there are seats for A.
    this.oddCapacity = (this.vehicle?.capacity ?? 40) % 2 !== 0;
  }

  getSeatByPosition(row: string, col: number): SeatDto | undefined {
    return this.seats.find(s => {
      const seatRow = s.seatNumber.charAt(0);
      const seatCol = parseInt(s.seatNumber.substring(1), 10);
      return seatRow === row && seatCol === col;
    });
  }

  get selectedSeatLabels(): string {
    return this.selectedSeats.map(s => s.seatNumber).join(', ');
  }

  toggleSeat(seat: SeatDto): void {
    if (seat.status === 'reserved') return;

    if (seat.status === 'selected') {
      seat.status = 'available';
      this.selectedSeats = this.selectedSeats.filter(s => s.id !== seat.id);
    } else {
      seat.status = 'selected';
      this.selectedSeats = [...this.selectedSeats, seat];
    }
  }

  clearSelection(): void {
    this.selectedSeats.forEach(s => (s.status = 'available'));
    this.selectedSeats = [];
  }

  confirmBooking(): void {
    // simple optimistic booking; update UI when API returns
    const seatsToBook = [...this.selectedSeats];
    this.selectedSeats = [];
    seatsToBook.forEach(seat => {
      this.seatService.bookSeat(seat.id, 'user1').subscribe({
        next: () => (seat.status = 'reserved'),
        error: () => (seat.status = 'available') // rollback on error
      });
    });
  }
}
