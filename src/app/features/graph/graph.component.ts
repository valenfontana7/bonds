import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import * as d3 from 'd3';
import { BondsService } from '../../core/services/bonds.service';
import {
  INTERACTION_ICONS,
  INTERACTION_LABELS,
  InteractionType,
  PersonWithStatus,
} from '../../core/models/person.model';
import { StatusBadgeComponent } from '../../shared/status-badge/status-badge.component';
import { PersonAvatarComponent } from '../../shared/person-avatar/person-avatar.component';

interface GraphNode {
  id: string;
  isSelf: boolean;
  person?: PersonWithStatus;
  x: number;
  y: number;
  radius: number;
  angle: number;
  distance: number;
}

interface GraphLink {
  source: GraphNode;
  target: GraphNode;
  strength: number;
}

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [RouterLink, StatusBadgeComponent, PersonAvatarComponent],
  template: `
    <section class="graph-page">
      @if (people().length === 0) {
        <div class="empty-state">
          <div class="empty-icon">◉</div>
          <h1>Tu red</h1>
          <p>Tu mundo social está vacío.</p>
          <p class="hint">
            Agrega a alguien importante para empezar a visualizar quién está
            cerca y quién necesita atención.
          </p>
          <div class="empty-actions">
            <a routerLink="/bienvenida" class="btn-primary">Empezar</a>
          </div>
        </div>
      } @else {
        <div class="canvas" #graphContainer>
          <svg #graphSvg></svg>

          <header class="overlay-header">
            <div class="header-text">
              <span class="eyebrow">Tu red</span>
              <span class="stats"
                >{{ people().length }} personas · {{ needsCount() }} piden
                atención</span
              >
            </div>
          </header>

          @if (needsAttention().length > 0) {
            <div
              class="attention-rail"
              aria-label="Personas que necesitan atención"
            >
              @for (person of needsAttention().slice(0, 5); track person.id) {
                <button
                  type="button"
                  class="attention-chip"
                  [class]="person.status"
                  (click)="focusPerson(person.id)"
                >
                  {{ person.name }}
                </button>
              }
            </div>
          }

          @if (selected(); as person) {
            <div
              class="detail-sheet"
              role="dialog"
              aria-label="Detalle de persona"
            >
              <button
                type="button"
                class="sheet-close"
                (click)="clearSelection()"
                aria-label="Cerrar"
              >
                ×
              </button>
              <div class="sheet-profile">
                <app-person-avatar
                  [name]="person.name"
                  [photo]="person.photo"
                  [size]="56"
                />
                <div>
                  <strong>{{ person.name }}</strong>
                  <span class="sheet-meta"
                    >Hace {{ person.daysSinceContact }} días</span
                  >
                  <app-status-badge
                    [status]="person.status"
                    [label]="person.statusLabel"
                  />
                </div>
              </div>
              <div class="quick-actions">
                @for (type of quickTypes; track type) {
                  <button
                    type="button"
                    class="quick-btn"
                    (click)="logQuick(person.id, type)"
                  >
                    <span>{{ interactionIcons[type] }}</span>
                    {{ interactionLabels[type] }}
                  </button>
                }
              </div>
              <a [routerLink]="['/personas', person.id]" class="sheet-link"
                >Ver perfil completo →</a
              >
            </div>
          } @else {
            <p class="canvas-hint">
              Tocá una persona para conectar · Arrastrá para explorar
            </p>
          }
        </div>
      }
    </section>
  `,
  styles: `
    .graph-page {
      margin: calc(-1 * var(--page-top)) calc(-1 * var(--page-gutter)) calc(-1 * var(--page-bottom));
      height: calc(100dvh - var(--bottom-nav-total));
      min-height: 420px;
      display: flex;
      flex-direction: column;
    }

    .canvas {
      position: relative;
      flex: 1;
      overflow: hidden;
      background:
        radial-gradient(
          ellipse 80% 60% at 50% 45%,
          rgba(99, 102, 241, 0.12) 0%,
          transparent 65%
        ),
        radial-gradient(
          circle at 50% 50%,
          rgba(15, 17, 26, 0) 0%,
          var(--bg) 100%
        );
      touch-action: none;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
      cursor: grab;

      &:active {
        cursor: grabbing;
      }
    }

    .overlay-header {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: calc(0.85rem + var(--sat)) var(--page-gutter) 0.85rem;
      background: linear-gradient(
        180deg,
        rgba(15, 17, 26, 0.85) 0%,
        transparent 100%
      );
      pointer-events: none;
    }

    .header-text {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
    }

    .eyebrow {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .stats {
      font-size: 0.78rem;
      color: var(--text-muted);
    }

    .attention-rail {
      position: absolute;
      top: calc(4.5rem + var(--sat));
      left: 0;
      right: 0;
      display: flex;
      gap: 0.5rem;
      padding: 0 1rem;
      overflow-x: auto;
      scrollbar-width: none;
      mask-image: linear-gradient(
        90deg,
        transparent,
        black 1rem,
        black calc(100% - 1rem),
        transparent
      );

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .attention-chip {
      flex-shrink: 0;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(26, 29, 46, 0.85);
      backdrop-filter: blur(8px);
      color: var(--text);
      font-size: 0.78rem;
      font-weight: 500;
      cursor: pointer;
      transition:
        transform 0.15s,
        border-color 0.2s;

      &:hover {
        transform: translateY(-1px);
      }

      &.soon {
        border-color: rgba(251, 191, 36, 0.45);
        color: #fcd34d;
      }
      &.reconnect {
        border-color: rgba(251, 146, 60, 0.45);
        color: #fdba74;
      }
      &.attention {
        border-color: rgba(248, 113, 113, 0.45);
        color: #fca5a5;
      }
    }

    .canvas-hint {
      position: absolute;
      bottom: 0.75rem;
      left: 0;
      right: 0;
      margin: 0;
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      opacity: 0.7;
      pointer-events: none;
    }

    .detail-sheet {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 1rem var(--page-gutter) calc(1rem + var(--sab));
      background: rgba(26, 29, 46, 0.94);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      border-radius: 1.25rem 1.25rem 0 0;
      animation: slideUp 0.25s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .sheet-close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      width: 2rem;
      height: 2rem;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      font-size: 1.25rem;
      line-height: 1;
      cursor: pointer;
    }

    .sheet-profile {
      display: flex;
      gap: 0.85rem;
      align-items: center;
      margin-bottom: 0.85rem;

      strong {
        display: block;
        font-size: 1.05rem;
        margin-bottom: 0.15rem;
      }
    }

    .sheet-meta {
      display: block;
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }

    .quick-actions {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }

    .quick-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.2rem;
      padding: 0.5rem 0.25rem;
      border: 1px solid var(--border);
      border-radius: 0.65rem;
      background: var(--bg);
      color: var(--text-muted);
      font-size: 0.62rem;
      cursor: pointer;
      transition:
        border-color 0.2s,
        color 0.2s;

      span {
        font-size: 1.1rem;
      }

      &:hover {
        border-color: rgba(99, 102, 241, 0.5);
        color: var(--text);
      }
    }

    .sheet-link {
      display: block;
      text-align: center;
      font-size: 0.82rem;
      color: #a5b4fc;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: calc(2rem + var(--sat)) 1.5rem 2rem;
      gap: 0.5rem;

      h1 {
        margin: 0.5rem 0 0;
        font-size: 1.5rem;
      }

      p {
        margin: 0;
        color: var(--text-muted);
      }

      .hint {
        font-size: 0.9rem;
        max-width: 280px;
        line-height: 1.5;
      }
    }

    .empty-icon {
      font-size: 3rem;
      opacity: 0.4;
      color: #6366f1;
    }

    .empty-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: 1.25rem;
      width: 100%;
      max-width: 240px;
    }

    @media (min-width: 768px) {
      .graph-page {
        height: calc(100dvh - var(--bottom-nav-total));
      }

      .quick-actions {
        max-width: 360px;
        margin-left: auto;
        margin-right: auto;
      }
    }
  `,
})
export class GraphComponent implements AfterViewInit, OnDestroy {
  @ViewChild('graphSvg') svgRef!: ElementRef<SVGSVGElement>;
  @ViewChild('graphContainer') containerRef!: ElementRef<HTMLDivElement>;

  private readonly bonds = inject(BondsService);
  private resizeObserver?: ResizeObserver;
  private viewReady = false;
  private zoomBehavior?: d3.ZoomBehavior<SVGSVGElement, unknown>;
  private zoomLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private nodePositions = new Map<string, { x: number; y: number }>();

  readonly people = this.bonds.peopleWithStatus;
  readonly needsAttention = this.bonds.needsAttention;
  readonly needsCount = computed(() => this.needsAttention().length);
  readonly selected = signal<PersonWithStatus | null>(null);

  readonly quickTypes: InteractionType[] = [
    'mensaje',
    'llamada',
    'visita',
    'salida',
    'videollamada',
  ];
  readonly interactionLabels = INTERACTION_LABELS;
  readonly interactionIcons = INTERACTION_ICONS;

  constructor() {
    effect(() => {
      this.people();
      if (this.viewReady) {
        this.renderGraph();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderGraph();
    this.resizeObserver = new ResizeObserver(() => this.renderGraph());
    this.resizeObserver.observe(this.containerRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  clearSelection(): void {
    this.selected.set(null);
    this.highlightNode(null);
  }

  focusPerson(id: string): void {
    const person = this.people().find((p) => p.id === id);
    if (!person) return;
    this.selected.set(person);
    this.highlightNode(id);
    this.panToNode(id);
  }

  logQuick(personId: string, type: InteractionType): void {
    this.bonds.logInteraction(personId, type);
    this.selected.set(this.bonds.getPerson(personId) ?? null);
  }

  private renderGraph(): void {
    const people = this.people();
    if (!this.svgRef || people.length === 0) return;

    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(this.svgRef.nativeElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const centerX = width / 2;
    const centerY = height / 2;
    const maxOrbit = Math.min(width, height) * 0.38;

    const nodes = this.buildNodes(people, centerX, centerY, maxOrbit);
    const links: GraphLink[] = people.map((p) => {
      const target = nodes.find((n) => n.id === p.id)!;
      return {
        source: nodes[0],
        target,
        strength: this.linkStrength(p),
      };
    });

    const defs = svg.append('defs');

    defs
      .append('radialGradient')
      .attr('id', 'self-glow')
      .attr('cx', '50%')
      .attr('cy', '50%')
      .attr('r', '50%')
      .selectAll('stop')
      .data([
        { offset: '0%', color: '#818cf8' },
        { offset: '100%', color: '#6366f1' },
      ])
      .join('stop')
      .attr('offset', (d) => d.offset)
      .attr('stop-color', (d) => d.color);

    const filter = defs
      .append('filter')
      .attr('id', 'node-glow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%');
    filter
      .append('feGaussianBlur')
      .attr('stdDeviation', '3')
      .attr('result', 'blur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    nodes.forEach((node) => {
      if (!node.isSelf && node.person?.photo) {
        defs
          .append('clipPath')
          .attr('id', `clip-${node.id}`)
          .append('circle')
          .attr('r', node.radius - 3);
      }
    });

    const g = svg.append('g').attr('class', 'zoom-layer');

    this.zoomLayer = g;
    this.zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.6, 2.5])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(this.zoomBehavior);

    const zones = [
      { ratio: 0.33, label: 'Cerca', opacity: 0.06 },
      { ratio: 0.66, label: 'Atención', opacity: 0.04 },
      { ratio: 1, label: 'Lejos', opacity: 0.025 },
    ];

    zones.forEach((zone) => {
      g.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', maxOrbit * zone.ratio)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255,255,255,0.08)')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', zone.ratio < 1 ? '4 6' : 'none');

      g.append('text')
        .attr('x', centerX)
        .attr('y', centerY - maxOrbit * zone.ratio - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'rgba(148,163,184,0.35)')
        .attr('font-size', 9)
        .text(zone.label);
    });

    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y)
      .attr('stroke', (d) => this.statusColor(d.target.person!.status))
      .attr('stroke-width', (d) => 1 + d.strength * 2.5)
      .attr('stroke-opacity', (d) => 0.15 + d.strength * 0.55)
      .attr('stroke-linecap', 'round');

    const nodeGroup = g.append('g').attr('class', 'nodes');
    const node = nodeGroup
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, (d) => d.id)
      .join('g')
      .attr('class', (d) => `node ${d.isSelf ? 'self' : d.person!.status}`)
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('cursor', (d) => (d.isSelf ? 'default' : 'pointer'))
      .style('opacity', 0)
      .on('click', (event, d) => {
        event.stopPropagation();
        if (d.isSelf || !d.person) return;
        this.selected.set(d.person);
        this.highlightNode(d.id);
      });

    node
      .transition()
      .duration(600)
      .delay((_, i) => i * 40)
      .style('opacity', (d) => (d.isSelf ? 1 : this.nodeOpacity(d)));

    node
      .filter((d) => !d.isSelf && d.person!.status === 'attention')
      .append('circle')
      .attr('r', (d) => d.radius + 8)
      .attr('fill', 'none')
      .attr('stroke', '#f87171')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0.5)
      .attr('class', 'pulse-ring')
      .append('animate')
      .attr('attributeName', 'r')
      .attr('values', (d) => `${d.radius + 4};${d.radius + 12};${d.radius + 4}`)
      .attr('dur', '2.5s')
      .attr('repeatCount', 'indefinite');

    node
      .append('circle')
      .attr('class', 'node-body')
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => (d.isSelf ? 'url(#self-glow)' : this.nodeFill(d)))
      .attr('stroke', (d) => this.nodeStroke(d))
      .attr('stroke-width', (d) => (d.isSelf ? 3 : 2.5))
      .attr('filter', (d) =>
        !d.isSelf && d.person!.status === 'well' ? 'url(#node-glow)' : null,
      );

    node
      .filter((d) => !d.isSelf && !!d.person?.photo)
      .append('image')
      .attr('href', (d) => d.person!.photo!)
      .attr('x', (d) => -(d.radius - 3))
      .attr('y', (d) => -(d.radius - 3))
      .attr('width', (d) => (d.radius - 3) * 2)
      .attr('height', (d) => (d.radius - 3) * 2)
      .attr('clip-path', (d) => `url(#clip-${d.id})`);

    node
      .filter((d) => !d.isSelf && !d.person?.photo)
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('fill', 'white')
      .attr('font-size', (d) => d.radius * 0.55)
      .attr('font-weight', 600)
      .text((d) => this.initials(d.person!.name));

    node
      .append('text')
      .attr('class', 'node-label')
      .text((d) => (d.isSelf ? 'YO' : d.person!.name))
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 14)
      .attr('fill', (d) => this.labelColor(d))
      .attr('font-size', (d) => (d.isSelf ? 12 : 10))
      .attr('font-weight', (d) => (d.isSelf ? 700 : 500));

    node
      .filter((d) => !d.isSelf)
      .append('text')
      .attr('class', 'node-days')
      .text((d) => `${d.person!.daysSinceContact}d`)
      .attr('text-anchor', 'middle')
      .attr('dy', (d) => d.radius + 26)
      .attr('fill', 'rgba(148,163,184,0.6)')
      .attr('font-size', 8);

    svg.on('click', () => this.clearSelection());

    this.nodePositions.clear();
    nodes.forEach((n) => this.nodePositions.set(n.id, { x: n.x, y: n.y }));

    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
  }

  private buildNodes(
    people: PersonWithStatus[],
    centerX: number,
    centerY: number,
    maxOrbit: number,
  ): GraphNode[] {
    const selfNode: GraphNode = {
      id: 'self',
      isSelf: true,
      x: centerX,
      y: centerY,
      radius: 32,
      angle: 0,
      distance: 0,
    };

    const minOrbit = maxOrbit * 0.28;
    const sorted = [...people].sort((a, b) => a.name.localeCompare(b.name));

    const personNodes: GraphNode[] = sorted.map((person, i) => {
      const ratio = Math.min(person.attentionRatio, 2.5) / 2.5;
      const distance = minOrbit + ratio * (maxOrbit - minOrbit);
      const angle = (i / sorted.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 26 - Math.min(person.attentionRatio, 2) * 3;

      return {
        id: person.id,
        isSelf: false,
        person,
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        radius: Math.max(20, radius),
        angle,
        distance,
      };
    });

    return [selfNode, ...personNodes];
  }

  private panToNode(id: string): void {
    const pos = this.nodePositions.get(id);
    if (!pos || !this.zoomBehavior || !this.svgRef) return;

    const container = this.containerRef.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;
    const svg = d3.select(this.svgRef.nativeElement);

    svg
      .transition()
      .duration(450)
      .call(
        this.zoomBehavior.transform,
        d3.zoomIdentity
          .translate(width / 2, height / 2)
          .scale(1.3)
          .translate(-pos.x, -pos.y),
      );
  }

  private highlightNode(id: string | null): void {
    if (!this.zoomLayer) return;
    const layer = this.zoomLayer;
    layer.selectAll<SVGGElement, GraphNode>('g.node').each((d, _i, nodes) => {
      const el = d3.select(nodes[_i]);
      const isSelected = id === d.id;
      const dimmed = id !== null && !d.isSelf && d.id !== id;
      el.style('opacity', dimmed ? 0.25 : d.isSelf ? 1 : this.nodeOpacity(d));
      el.select('circle.node-body')
        .attr('stroke-width', isSelected ? 4 : d.isSelf ? 3 : 2.5)
        .attr('stroke', isSelected ? '#a5b4fc' : this.nodeStroke(d));
    });
  }

  private linkStrength(person: PersonWithStatus): number {
    return Math.max(0.12, 1 - Math.min(person.attentionRatio, 2.5) / 2.5);
  }

  private nodeFill(node: GraphNode): string {
    const ratio = node.person!.attentionRatio;
    if (ratio > 1.5) return '#475569';
    return this.statusColor(node.person!.status);
  }

  private nodeStroke(node: GraphNode): string {
    if (node.isSelf) return '#c7d2fe';
    return this.statusColor(node.person!.status);
  }

  private nodeOpacity(node: GraphNode): number {
    const ratio = node.person!.attentionRatio;
    return Math.max(0.45, 1 - Math.min(ratio - 0.8, 1.7) * 0.3);
  }

  private labelColor(node: GraphNode): string {
    if (node.isSelf) return '#e0e7ff';
    return this.nodeOpacity(node) < 0.65 ? '#64748b' : '#cbd5e1';
  }

  private statusColor(status: string): string {
    const colors: Record<string, string> = {
      well: '#34d399',
      soon: '#fbbf24',
      reconnect: '#fb923c',
      attention: '#f87171',
    };
    return colors[status] ?? '#64748b';
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }
}
