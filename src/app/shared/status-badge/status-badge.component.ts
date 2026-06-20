import { Component, Input } from '@angular/core';
import { ConnectionStatus } from '../../core/models/person.model';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span class="badge" [class]="status" role="status">
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
      background: var(--status-well-bg);
      color: var(--status-well-text);
      .dot { background: var(--status-well-dot); }
    }

    .soon {
      background: var(--status-soon-bg);
      color: var(--status-soon-text);
      .dot { background: var(--status-soon-dot); }
    }

    .reconnect {
      background: var(--status-reconnect-bg);
      color: var(--status-reconnect-text);
      .dot { background: var(--status-reconnect-dot); }
    }

    .attention {
      background: var(--status-attention-bg);
      color: var(--status-attention-text);
      .dot { background: var(--status-attention-dot); }
    }
  `,
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: ConnectionStatus;
  @Input({ required: true }) label!: string;
}
