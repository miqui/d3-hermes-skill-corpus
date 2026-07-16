import { useEffect, useRef, useState } from 'react';
import {
  arc as d3Arc,
  hierarchy,
  interpolate,
  interpolateHcl,
  partition,
  select,
  zoom,
  zoomIdentity,
  type HierarchyRectangularNode,
} from 'd3';
import type { CorpusNode } from '../types';

type SunburstViewProps = {
  tree: CorpusNode;
  highlightedSkillIds: Set<string>;
  selectedSkillId: string | null;
  onSelectSkill: (skillId: string) => void;
};

type ArcCoords = { x0: number; x1: number; y0: number; y1: number };
type SunburstNode = HierarchyRectangularNode<CorpusNode> & {
  current: ArcCoords;
  target?: ArcCoords;
};

// Rings shown at once; deeper levels appear as you zoom in.
const VISIBLE_RINGS = 3;
const ZOOM_DURATION = 550;

function arcOpacity(node: SunburstNode) {
  return node.children ? 0.82 : 0.55;
}

function truncate(value: string, max = 20) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function SunburstView({
  highlightedSkillIds,
  onSelectSkill,
  selectedSkillId,
  tree,
}: SunburstViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const applyHighlightRef = useRef<(() => void) | null>(null);
  const resetViewportRef = useRef<(() => void) | null>(null);
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

    const root = hierarchy(tree)
      .sum((d) => (d.type === 'skill' ? 1 : 0))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) as SunburstNode;
    partition<CorpusNode>().size([2 * Math.PI, root.height + 1])(root);
    root.each((d) => {
      (d as SunburstNode).current = { x0: d.x0, x1: d.x1, y0: d.y0, y1: d.y1 };
    });

    const topLevelNodes = root.children ?? [];
    const categoryColors = new Map<HierarchyRectangularNode<CorpusNode>, string>();
    topLevelNodes.forEach((node, index) => {
      const position = topLevelNodes.length > 1 ? index / (topLevelNodes.length - 1) : 0.5;
      categoryColors.set(node, interpolateHcl('#38bdf8', '#c4b5fd')(position));
    });
    const arcFill = (node: SunburstNode) => {
      const category = node.ancestors().find((ancestor) => ancestor.depth === 1);
      const baseColor = categoryColors.get(category!) ?? '#818cf8';
      return interpolateHcl(baseColor, '#1e293b')(Math.min(0.48, (node.depth - 1) * 0.16));
    };

    const visibleRings = Math.min(root.height, VISIBLE_RINGS);
    if (visibleRings === 0) return;
    const radius = Math.min(width, height) / ((visibleRings + 1) * 2);

    const arcGen = d3Arc<ArcCoords>()
      .startAngle((d) => d.x0)
      .endAngle((d) => d.x1)
      .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d) => d.y0 * radius)
      .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 2));

    const arcVisible = (d: ArcCoords) => d.y1 <= visibleRings + 1 && d.y0 >= 1 && d.x1 > d.x0;
    const labelVisible = (d: ArcCoords) =>
      d.y1 <= visibleRings + 1 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.04;
    const labelTransform = (d: ArcCoords) => {
      const angle = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
      const distance = ((d.y0 + d.y1) / 2) * radius;
      return `rotate(${angle - 90}) translate(${distance},0) rotate(${angle < 180 ? 0 : 180})`;
    };

    const svg = select(svgElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);
    const g = svg.append('g');

    const showTooltip = (event: PointerEvent, node: SunburstNode) => {
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

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .extent([
        [-width / 2, -height / 2],
        [width / 2, height / 2],
      ])
      .translateExtent([
        [-width / 2, -height / 2],
        [width / 2, height / 2],
      ])
      .scaleExtent([1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
        hideTooltip();
      });
    svg.call(zoomBehavior);
    resetViewportRef.current = () => {
      svg.call(zoomBehavior.transform, zoomIdentity);
    };

    const path = g
      .append('g')
      .selectAll('path')
      .data(root.descendants().slice(1) as SunburstNode[])
      .join('path')
      .attr('class', 'sunburst-arc')
      .attr('fill', (d) => arcFill(d))
      .attr('fill-opacity', (d) => (arcVisible(d.current) ? arcOpacity(d) : 0))
      .attr('pointer-events', (d) => (arcVisible(d.current) ? 'auto' : 'none'))
      .attr('d', (d) => arcGen(d.current))
      .style('cursor', 'pointer')
      .on('pointermove', (event: PointerEvent, d) => showTooltip(event, d))
      .on('pointerleave', hideTooltip);

    const label = g
      .append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .selectAll('text')
      .data(root.descendants().slice(1) as SunburstNode[])
      .join('text')
      .attr('class', 'sunburst-label')
      .attr('dy', '0.35em')
      .attr('fill-opacity', (d) => Number(labelVisible(d.current)))
      .attr('transform', (d) => labelTransform(d.current))
      .text((d) => truncate(d.data.name));

    const centerTarget = g
      .append('circle')
      .datum(root as SunburstNode)
      .attr('class', 'sunburst-center')
      .attr('r', radius)
      .attr('fill', 'transparent')
      .attr('pointer-events', 'all');

    const centerLabel = g
      .append('text')
      .attr('class', 'sunburst-center-label')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle');
    const centerName = centerLabel.append('tspan').attr('x', 0).attr('dy', '-0.2em');
    const centerCount = centerLabel
      .append('tspan')
      .attr('class', 'sunburst-center-sub')
      .attr('x', 0)
      .attr('dy', '1.5em');

    const setCenter = (node: SunburstNode) => {
      centerName.text(truncate(node.data.name, 24));
      centerCount.text(`${node.value ?? 0} skills`);
      centerTarget.style('cursor', node.depth > 0 ? 'pointer' : 'default');
    };
    setCenter(root);

    const zoomTo = (focus: SunburstNode) => {
      centerTarget.datum((focus.parent as SunburstNode) ?? root);
      setCenter(focus);

      root.each((node) => {
        (node as SunburstNode).target = {
          x0: Math.max(0, Math.min(1, (node.x0 - focus.x0) / (focus.x1 - focus.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (node.x1 - focus.x0) / (focus.x1 - focus.x0))) * 2 * Math.PI,
          y0: Math.max(0, node.y0 - focus.depth),
          y1: Math.max(0, node.y1 - focus.depth),
        };
      });

      const transition = g.transition().duration(ZOOM_DURATION);

      path
        .transition(transition as never)
        .tween('data', (d) => {
          const interpolator = interpolate(d.current, d.target!);
          return (t) => {
            d.current = interpolator(t);
          };
        })
        .filter((d) => arcVisible(d.current) || arcVisible(d.target!))
        .attr('fill-opacity', (d) => (arcVisible(d.target!) ? arcOpacity(d) : 0))
        .attr('pointer-events', (d) => (arcVisible(d.target!) ? 'auto' : 'none'))
        .attrTween('d', (d) => () => arcGen(d.current) ?? '');

      label
        .filter((d) => labelVisible(d.current) || labelVisible(d.target!))
        .transition(transition as never)
        .attr('fill-opacity', (d) => Number(labelVisible(d.target!)))
        .attrTween('transform', (d) => () => labelTransform(d.current));
    };

    path.on('click', (_event, d) => {
      if (d.data.type === 'skill') {
        if (d.data.skillId) onSelectSkillRef.current(d.data.skillId);
        return;
      }
      hideTooltip();
      zoomTo(d);
    });

    centerTarget.on('click', (_event, d) => {
      if (d) zoomTo(d);
    });

    const applyHighlight = () => {
      path
        .classed('selected', (d) => Boolean(d.data.skillId) && d.data.skillId === selectedSkillIdRef.current)
        .classed(
          'related',
          (d) => Boolean(d.data.skillId && highlightedSkillIdsRef.current.has(d.data.skillId)),
        );
    };
    applyHighlight();
    applyHighlightRef.current = applyHighlight;

    return () => {
      applyHighlightRef.current = null;
      resetViewportRef.current = null;
      svg.selectAll('*').interrupt().remove();
      svg.on('.zoom', null);
    };
  }, [sizeVersion, tree]);

  useEffect(() => {
    applyHighlightRef.current?.();
  }, [highlightedSkillIds, selectedSkillId]);

  return (
    <div className="sunburst-wrapper" ref={containerRef}>
      <svg className="sunburst-svg" ref={svgRef} role="img" aria-label="Zoomable sunburst of the skill corpus" />
      <div className="sunburst-legend">
        <span>
          <span className="legend-dot" />
          Color flows by category and depth
        </span>
      </div>
      <button className="sunburst-reset" onClick={() => resetViewportRef.current?.()} type="button">
        Reset view
      </button>
      <div className="sunburst-tooltip" ref={tooltipRef} />
    </div>
  );
}
