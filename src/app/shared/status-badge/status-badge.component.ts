import { Component, Input } from '@angular/core';
import { ConnectionStatus } from '../../core/models/person.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge" [class]="status">
      <span class="dot" aria-hidden="true"></span>
      {{ label }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 500;
      line-height: 1.3;
    }

    .dot {
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .well {
      background: rgba(52, 211, 153, 0.15);
      color: #6ee7b7;
      .dot { background: #34d399; }
    }

    .soon {
      background: rgba(251, 191, 36, 0.15);
      color: #fcd34d;
      .dot { background: #fbbf24; }
    }

    .reconnect {
      background: rgba(251, 146, 60, 0.15);
      color: #fdba74;
      .dot { background: #fb923c; }
    }

    .attention {
      background: rgba(248, 113, 113, 0.15);
      color: #fca5a5;
      .dot { background: #f87171; }
    }
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: ConnectionStatus;
  @Input({ required: true }) label!: string;
}
