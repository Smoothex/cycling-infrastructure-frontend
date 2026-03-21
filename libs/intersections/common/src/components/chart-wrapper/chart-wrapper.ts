import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';

@Component({
  selector: 'chart-wrapper',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, PopoverModule],
  templateUrl: './chart-wrapper.html'
})
export class ChartWrapper {}