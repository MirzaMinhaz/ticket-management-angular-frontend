import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  seatMap: Record<string, SeatDto> = {};
  selectedSeats: SeatDto[] = [];
  selectedBusId: number = 0;
  vehicle: Vehicle | null = null;

  rows: string[] = [];
  leftCols: number[] = [1, 2];
  rightCols: number[] = [3, 4];

  oddCapacity: boolean = false;
  isLoading: boolean = false;
  loadError: string | null = null;


  constructor(
    private vehicleService: VehicleService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const vehicleId = +params['vehicleId'];
      if (!vehicleId) return;

      this.selectedBusId = vehicleId;
      this.isLoading = true;

      this.vehicleService.getById(vehicleId).subscribe({
        next: (v) => {
          this.vehicle = v;
          const capacity = v.capacity ?? 40;
          this.oddCapacity = capacity % 2 !== 0;
          this.generateSeats(capacity);
          this.isLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.vehicle = null;
          this.isLoading = false;
        }
      });
    });
  }

  /** Generate seats based on vehicle capacity */
  private generateSeats(capacity: number): void {
    const seats: SeatDto[] = [];
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let count = 0;

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

    // adjust if capacity odd
    if (capacity % 2 !== 0) {
      const idx = seats.findIndex(s => s.seatNumber === 'A1');
      if (idx !== -1) seats.splice(idx, 1);
    }

    // fill last row to always have 4 seats
    if (seats.length) {
      const lastRow = seats[seats.length - 1].seatNumber.charAt(0);
      const lastRowSeats = seats.filter(s => s.seatNumber.charAt(0) === lastRow);
      const existingCols = new Set(lastRowSeats.map(s => parseInt(s.seatNumber.substring(1), 10)));
      for (let c = 1; c <= 4; c++) {
        if (!existingCols.has(c)) {
          count++;
          seats.push({
            id: count,
            seatNumber: `${lastRow}${c}`,
            seatCode: `${lastRow}${c}`,
            isBooked: false,
            status: 'available'
          });
        }
      }
    }

    this.seats = seats;
    this.prepareSeatMap(seats);
  }

  /** Build row array and O(1) seat map */
  private prepareSeatMap(seats: SeatDto[]): void {
    seats.sort((a, b) => {
      const ra = a.seatNumber.charAt(0);
      const rb = b.seatNumber.charAt(0);
      if (ra !== rb) return ra.charCodeAt(0) - rb.charCodeAt(0);
      return parseInt(a.seatNumber.substring(1), 10) - parseInt(b.seatNumber.substring(1), 10);
    });

    this.rows = Array.from(new Set(seats.map(s => s.seatNumber.charAt(0))));
    this.seatMap = {};
    for (const s of seats) {
      this.seatMap[s.seatNumber] = s;
    }
  }

  getSeatByPosition(row: string, col: number): SeatDto | undefined {
    return this.seatMap?.[`${row}${col}`];
  }

  toggleSeat(seat: SeatDto): void {
    if (!seat || seat.status === 'reserved') return;

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
    if (!this.selectedSeats.length) return;
    // keep UI only; booking API removed
    this.selectedSeats.forEach(s => (s.status = 'reserved'));
    this.selectedSeats = [];
  }

  trackRow(index: number, row: string) { return row; }
  trackCol(index: number, col: number) { return col; }
}
