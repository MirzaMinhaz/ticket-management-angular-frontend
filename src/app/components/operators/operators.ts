import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OperatorService } from '../../services/operators.service';

@Component({
  selector: 'app-operator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './operators.html',
  styleUrls: ['./operators.css']
})
export class OperatorComponent implements OnInit {
  operatorForm!: FormGroup;
  operators: any[] = [];
  loading = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private operatorService: OperatorService) {}

  ngOnInit(): void {
    this.operatorForm = this.fb.group({
      id: [null],
      name: ['', Validators.required],
      type: ['', Validators.required]
    });

    this.loadOperators();
  }

  loadOperators(): void {
    this.loading = true;
    this.operatorService.getAll().subscribe({
      next: data => {
        this.operators = data;
        this.loading = false;
      },
      error: err => {
        this.errorMessage = 'Failed to load operators.';
        this.loading = false;
      }
    });
  }

  onSubmit(): void {
    if (this.operatorForm.invalid) return;

    const payload = this.operatorForm.value;
    this.loading = true;

    const request = payload.id
      ? this.operatorService.update(payload.id, payload)
      : this.operatorService.create(payload);

    request.subscribe({
      next: () => {
        this.operatorForm.reset();
        this.loadOperators();
      },
      error: err => {
        this.errorMessage = 'Failed to save operator.';
        this.loading = false;
      }
    });
  }

  edit(op: any): void {
    this.operatorForm.patchValue(op);
  }

  delete(id: number): void {
    if (!confirm('Are you sure you want to delete this operator?')) return;

    this.loading = true;
    this.operatorService.delete(id).subscribe({
      next: () => this.loadOperators(),
      error: err => {
        this.errorMessage = 'Failed to delete operator.';
        this.loading = false;
      }
    });
  }
}
