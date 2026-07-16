import { useEffect, useRef, useState } from 'react';
import {
  hierarchy,
  interpolateHcl,
  interpolateZoom,
  pack,
  select,
  zoom as d3Zoom,
  zoomIdentity,
  type HierarchyCircularNode,
} from 'd3';
import type { CorpusNode } from '../types';

type CirclePackingViewProps = {
  tree: CorpusNode;
  highlightedSkillIds: Set<string>;
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
};

type CirclePackNode = HierarchyCircularNode<CorpusNode>;
type PackView = [number, number, number];

const ZOOM_DURATION = 650;

function truncate(value: string, max = 22) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function CirclePackingView({
  highlightedSkillIds,
  onSelectSkill,
  selectedSkillId,
  tree,
}: CirclePackingViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const applyHighlightRef = useRef<(() => void) | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const [sizeVersion, setSizeVersion] = useState(0);

  const onSelectSkillRef = useRef(onSelectSkill);
  onSelectSkillRef.current = onSelectSkill;
  const selectedSkillIdRef = useRef(selectedSkillId);
  selectedSkillIdRef.current = selectedSkillId;
  const highlightedSkillIdsRef = useRef(highlightedSkillIds);
  highlightedSkillIdsRef.current = highlightedSkillIds;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let lastWidth = container.clientWidth;
    let lastHeight = container.clientHeight;
    const observer = new ResizeObserver(() => {
      const { clientHeight, clientWidth } = container;
      if (clientWidth !== lastWidth || clientHeight !== lastHeight) {
        lastWidth = clientWidth;
        lastHeight = clientHeight;
        setSizeVersion((version) => version + 1);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const svgElement = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !svgElement || !tooltip) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    const viewportDiameter = Math.min(width, height);
    const viewportCenterX = width / 2;
    const viewportCenterY = height / 2;

    const root = pack<CorpusNode>()
      .size([width, height])
      .padding(5)(
        hierarchy(tree)
          .sum((node) => (node.type === 'skill' ? 1 : 0))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      ) as CirclePackNode;
    const nodes = root.descendants().slice(1) as CirclePackNode[];
    const topLevelNodes = root.children ?? [];
    const categoryColors = new Map<string, string>();
    topLevelNodes.forEach((node, index) => {
      const position = topLevelNodes.length > 1 ? index / (topLevelNodes.length - 1) : 0.5;
      categoryColors.set(node.data.id, interpolateHcl('#38bdf8', '#c4b5fd')(position));
    });
    const nodeFill = (node: CirclePackNode) => {
      const category = node.ancestors().find((ancestor) => ancestor.depth === 1);
      const baseColor = categoryColors.get(category?.data.id ?? '') ?? '#818cf8';
      const depthBlend = node.children ? Math.min(0.38, (node.depth - 1) * 0.14) : 0.44;
      return interpolateHcl(baseColor, '#1e293b')(depthBlend);
    };

    const svg = select(svgElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g');

    const showTooltip = (event: PointerEvent, node: CirclePackNode) => {
      const bounds = container.getBoundingClientRect();
      const detail =
        node.data.type === 'skill'
          ? node.data.description ?? 'skill'
          : `${node.value ?? 0} skill${(node.value ?? 0) === 1 ? '' : 's'}`;
      tooltip.innerHTML = `<strong></strong><span></span>`;
      tooltip.querySelector('strong')!.textContent = node.data.name;
      tooltip.querySelector('span')!.textContent = detail;
      tooltip.style.left = `${Math.min(event.clientX - bounds.left + 14, width - 220)}px`;
      tooltip.style.top = `${event.clientY - bounds.top + 14}px`;
      tooltip.style.opacity = '1';
    };
    const hideTooltip = () => {
      tooltip.style.opacity = '0';
    };

    const viewportZoom = d3Zoom<SVGSVGElement, unknown>()
      .extent([
        [0, 0],
        [width, height],
      ])
      .translateExtent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        hideTooltip();
      });
    svg.call(viewportZoom);

    const circle = g
      .append('g')
      .selectAll('circle')
      .data(nodes)
      .join('circle')
      .attr('class', (node) => `circle-pack-node${node.children ? ' group' : ''}`)
      .attr('fill', (node) => nodeFill(node))
      .attr('fill-opacity', (node) => (node.children ? 0.82 : 0.6))
      .style('cursor', 'pointer')
      .on('pointermove', (event: PointerEvent, node) => showTooltip(event, node))
      .on('pointerleave', hideTooltip);

    const label = g
      .append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(nodes)
      .join('text')
      .attr('class', 'circle-pack-label')
      .attr('dy', '0.35em')
      .text((node) => truncate(node.data.name));

    let focus = root;
    let view: PackView = [root.x, root.y, root.r * 2];
    const zoomTo = (nextView: PackView) => {
      const scale = viewportDiameter / nextView[2];
      view = nextView;
      circle
        .attr('cx', (node) => viewportCenterX + (node.x - nextView[0]) * scale)
        .attr('cy', (node) => viewportCenterY + (node.y - nextView[1]) * scale)
        .attr('r', (node) => node.r * scale);
      label.attr(
        'transform',
        (node) => `translate(${viewportCenterX + (node.x - nextView[0]) * scale},${viewportCenterY + (node.y - nextView[1]) * scale})`,
      );
    };
    const zoom = (nextFocus: CirclePackNode) => {
      focus = nextFocus;
      const transition = svg
        .transition()
        .duration(ZOOM_DURATION)
        .tween('zoom', () => {
          const interpolator = interpolateZoom(view, [focus.x, focus.y, focus.r * 2] as PackView);
          return (time) => zoomTo(interpolator(time) as PackView);
        });

      label
        .filter(function (node) {
          const labelElement = this as SVGTextElement;
          return node.parent === focus || labelElement.style.display === 'inline';
        })
        .transition(transition as never)
        .style('fill-opacity', (node) => (node.parent === focus ? 1 : 0))
        .on('start', function (node) {
          if (node.parent === focus) (this as SVGTextElement).style.display = 'inline';
        })
        .on('end', function (node) {
          if (node.parent !== focus) (this as SVGTextElement).style.display = 'none';
        });
    };

    zoomTo(view);
    label.style('display', (node) => (node.parent === focus ? 'inline' : 'none')).style('fill-opacity', (node) => (node.parent === focus ? 1 : 0));

    circle.on('click', (event, node) => {
      event.stopPropagation();
      hideTooltip();
      if (node.data.type === 'skill') {
        if (node.data.skillId) onSelectSkillRef.current(node.data.skillId);
        return;
      }
      zoom(node);
    });
    svg.on('click', () => zoom(root));
    resetViewRef.current = () => {
      svg.call(viewportZoom.transform, zoomIdentity);
      zoom(root);
    };

    const applyHighlight = () => {
      circle
        .classed('selected', (node) => Boolean(node.data.skillId) && node.data.skillId === selectedSkillIdRef.current)
        .classed(
          'related',
          (node) => Boolean(node.data.skillId && highlightedSkillIdsRef.current.has(node.data.skillId)),
        );
    };
    applyHighlight();
    applyHighlightRef.current = applyHighlight;

    return () => {
      applyHighlightRef.current = null;
      resetViewRef.current = null;
      svg.selectAll('*').interrupt().remove();
      svg.on('.zoom', null);
      svg.on('click', null);
    };
  }, [sizeVersion, tree]);

  useEffect(() => {
    applyHighlightRef.current?.();
  }, [highlightedSkillIds, selectedSkillId]);

  return (
    <div className="circle-pack-wrapper" ref={containerRef}>
      <svg className="circle-pack-svg" ref={svgRef} role="img" aria-label="Zoomable circle packing of the skill corpus" />
      <div className="circle-pack-legend">
        <span>
          <span className="legend-dot" />
          Color flows by category and depth
        </span>
      </div>
      <button className="circle-pack-reset" onClick={() => resetViewRef.current?.()} type="button">
        Reset view
      </button>
      <div className="circle-pack-tooltip" ref={tooltipRef} />
    </div>
  );
}
