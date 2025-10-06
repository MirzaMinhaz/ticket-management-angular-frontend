import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OperatorService } from '../../services/operators.service';
import { OperatorDto, CreateOperatorDto, UpdateOperatorDto } from '../../models/common';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './operators.html',
  styleUrls: ['./operators.css']
})
export class OperatorComponent implements OnInit {
  operatorForm!: FormGroup;
  operators: OperatorDto[] = [];
  loading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private operatorService: OperatorService) {}

  ngOnInit(): void {
    this.operatorForm = this.fb.group({
      id: [null],
      name: ['', Validators.required],
      type: ['', Validators.required]
      // ❌ operatorCode removed from form
    });

    this.loadOperators();
  }

  loadOperators(): void {
    this.loading = true;
    this.operatorService.getAll().subscribe({
      next: (data: OperatorDto[]) => {
        this.operators = data;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Load error:', err);
        this.errorMessage = 'Failed to load operators.';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.operatorForm.invalid) return;

    const payload = this.operatorForm.value;
    this.loading = true;

    let request: Observable<any>;

    if (payload.id) {
      const updatePayload: UpdateOperatorDto = {
        name: payload.name,
        type: payload.type
        // ❌ operatorCode excluded
      };
      request = this.operatorService.update(payload.id, updatePayload);
    } else {
      const createPayload: CreateOperatorDto = {
        name: payload.name,
        type: payload.type
        // ❌ operatorCode excluded
      };
      request = this.operatorService.create(createPayload);
    }

    request.subscribe({
      next: () => {
        this.operatorForm.reset();
        this.loadOperators();
      },
      error: (err: any) => {
        console.error('Save error:', err);
        this.errorMessage = 'Failed to save operator.';
        this.loading = false;
      }
    });
  }

  edit(op: OperatorDto): void {
    this.operatorForm.patchValue({
      id: op.id,
      name: op.name,
      type: op.type
      // ❌ operatorCode excluded from form
    });
  }

  delete(id: number): void {
    if (!confirm('Are you sure you want to delete this operator?')) return;

    this.loading = true;
    this.operatorService.delete(id).subscribe({
      next: () => this.loadOperators(),
      error: (err: any) => {
        console.error('Delete error:', err);
        this.errorMessage = 'Failed to delete operator.';
        this.loading = false;
      }
    });
  }
}
