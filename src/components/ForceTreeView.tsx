import { useCallback, useEffect, useRef, useState } from 'react';
import {
  drag,
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom,
  zoomIdentity,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3';
import type { CorpusNode, VisibleNode } from '../types';

type ForceTreeViewProps = {
  nodes: VisibleNode[];
  expandedIds: Set<string>;
  highlightedSkillIds: Set<string>;
  selectedSkillId: string | null;
  onNodeClick: (node: CorpusNode) => void;
};

type ForceNode = SimulationNodeDatum & {
  id: string;
  data: CorpusNode;
  depth: number;
  parentId?: string;
  hasChildren: boolean;
  isExpanded: boolean;
};

type ForceLink = SimulationLinkDatum<ForceNode>;

const FIT_PADDING = 48;
const MAX_FIT_SCALE = 1.25;

function nodeColor(node: CorpusNode) {
  if (node.type === 'root') return '#f97316';
  if (node.type === 'group') return '#818cf8';
  return '#34d399';
}

export function ForceTreeView({
  expandedIds,
  highlightedSkillIds,
  nodes,
  onNodeClick,
  selectedSkillId,
}: ForceTreeViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const fitToViewRef = useRef<((animate?: boolean) => void) | null>(null);
  const zoomByRef = useRef<((factor: number) => void) | null>(null);
  const applyHighlightRef = useRef<(() => void) | null>(null);
  const [sizeVersion, setSizeVersion] = useState(0);

  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
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

  const layoutKey = nodes.map((node) => node.id).join('|');
  const expandedKey = [...expandedIds].sort().join('|');
  const fitToView = useCallback((animate = true) => {
    fitToViewRef.current?.(animate);
  }, []);
  const zoomBy = useCallback((factor: number) => {
    zoomByRef.current?.(factor);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const svgElement = svgRef.current;
    const tooltip = tooltipRef.current;
    if (!container || !svgElement || !tooltip) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;

    const maxDepth = Math.max(...nodes.map((node) => node.depth));
    const depthPosition = (depth: number) => 80 + (depth / Math.max(1, maxDepth)) * (width - 160);
    const forceNodes: ForceNode[] = nodes.map((node, index) => ({
      id: node.id,
      data: node.data,
      depth: node.depth,
      parentId: node.parentId,
      hasChildren: node.hasChildren,
      isExpanded: expandedIds.has(node.id),
      x: depthPosition(node.depth),
      y: ((index + 1) / (nodes.length + 1)) * height,
    }));
    const forceLinks: ForceLink[] = forceNodes.flatMap((node) =>
      node.parentId ? [{ source: node.parentId, target: node.id }] : [],
    );
    const svg = select(svgElement);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const content = svg.append('g');

    const showTooltip = (event: PointerEvent, node: ForceNode) => {
      const bounds = container.getBoundingClientRect();
      const detail =
        node.data.type === 'skill'
          ? node.data.description ?? 'skill'
          : `${node.hasChildren ? 'Folder' : 'Group'} · ${node.isExpanded ? 'click to collapse' : 'click to expand'}`;
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
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        content.attr('transform', event.transform);
        hideTooltip();
      });
    svg.call(zoomBehavior);

    const link = content
      .append('g')
      .selectAll('line')
      .data(forceLinks)
      .join('line')
      .attr('class', 'force-tree-link');

    const node = content
      .append('g')
      .selectAll<SVGGElement, ForceNode>('g')
      .data(forceNodes)
      .join('g')
      .attr('class', 'force-tree-node')
      .style('cursor', 'pointer')
      .on('pointermove', (event: PointerEvent, entry) => showTooltip(event, entry))
      .on('pointerleave', hideTooltip)
      .on('click', (event, entry) => {
        event.stopPropagation();
        hideTooltip();
        onNodeClickRef.current(entry.data);
      });

    node
      .append('circle')
      .attr('class', 'force-tree-circle')
      .attr('fill', (entry) => nodeColor(entry.data))
      .attr('r', (entry) => (entry.data.type === 'skill' ? 9 : 12));

    node
      .filter((entry) => entry.hasChildren)
      .append('text')
      .attr('class', 'force-tree-glyph')
      .attr('dy', '0.35em')
      .attr('text-anchor', 'middle')
      .text((entry) => (entry.isExpanded ? '−' : '+'));

    node
      .append('text')
      .attr('class', 'force-tree-label')
      .attr('dy', '0.35em')
      .attr('x', (entry) => (entry.hasChildren ? 18 : 15))
      .text((entry) => entry.data.name);

    const simulation = forceSimulation(forceNodes)
      .force(
        'link',
        forceLink<ForceNode, ForceLink>(forceLinks)
          .id((entry) => entry.id)
          .distance(118)
          .strength(0.9),
      )
      .force('charge', forceManyBody<ForceNode>().strength(-280))
      .force('collide', forceCollide<ForceNode>().radius((entry) => (entry.data.type === 'skill' ? 22 : 30)).strength(0.9))
      .force(
        'x',
        forceX<ForceNode>((entry) => depthPosition(entry.depth)).strength(0.22),
      )
      .force('y', forceY<ForceNode>(height / 2).strength(0.035))
      .force('center', forceCenter(width / 2, height / 2))
      .alphaDecay(0.035);

    const updatePositions = () => {
      link
        .attr('x1', (entry) => (entry.source as ForceNode).x ?? 0)
        .attr('y1', (entry) => (entry.source as ForceNode).y ?? 0)
        .attr('x2', (entry) => (entry.target as ForceNode).x ?? 0)
        .attr('y2', (entry) => (entry.target as ForceNode).y ?? 0);
      node.attr('transform', (entry) => `translate(${entry.x ?? 0},${entry.y ?? 0})`);
    };

    const dragBehavior = drag<SVGGElement, ForceNode>()
      .on('start', (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      })
      .on('drag', (event) => {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on('end', (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      });
    node.call(dragBehavior);

    const fitContent = (animate = true) => {
      const contentElement = content.node();
      if (!contentElement) return;
      const contentBox = contentElement.getBBox();
      if (!contentBox.width || !contentBox.height) return;

      const scale = Math.min(
        (width - FIT_PADDING) / contentBox.width,
        (height - FIT_PADDING) / contentBox.height,
        MAX_FIT_SCALE,
      );
      const translateX = (width - contentBox.width * scale) / 2 - contentBox.x * scale;
      const translateY = (height - contentBox.height * scale) / 2 - contentBox.y * scale;
      const transform = zoomIdentity.translate(translateX, translateY).scale(scale);
      if (animate) {
        svg.transition().duration(300).call(zoomBehavior.transform, transform);
      } else {
        svg.call(zoomBehavior.transform, transform);
      }
    };
    fitToViewRef.current = fitContent;
    zoomByRef.current = (factor) => {
      svg.transition().duration(200).call(zoomBehavior.scaleBy, factor);
    };

    let hasFitted = false;
    simulation.on('tick', () => {
      updatePositions();
      if (!hasFitted && simulation.alpha() < 0.45) {
        hasFitted = true;
        fitContent(false);
      }
    });
    updatePositions();

    const applyHighlight = () => {
      node
        .classed('selected', (entry) => Boolean(entry.data.skillId) && entry.data.skillId === selectedSkillIdRef.current)
        .classed(
          'related',
          (entry) => Boolean(entry.data.skillId && highlightedSkillIdsRef.current.has(entry.data.skillId)),
        );
    };
    applyHighlight();
    applyHighlightRef.current = applyHighlight;

    return () => {
      simulation.stop();
      applyHighlightRef.current = null;
      fitToViewRef.current = null;
      zoomByRef.current = null;
      svg.on('.zoom', null);
      svg.selectAll('*').interrupt().remove();
    };
  }, [expandedKey, layoutKey, nodes, sizeVersion]);

  useEffect(() => {
    applyHighlightRef.current?.();
  }, [highlightedSkillIds, selectedSkillId]);

  return (
    <div className="force-tree-wrapper" ref={containerRef}>
      <svg className="force-tree-svg" ref={svgRef} role="img" aria-label="Zoomable force-directed tree of the skill corpus" />
      <div className="force-tree-controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.4)} type="button">
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)} type="button">
          −
        </button>
        <button aria-label="Fit force-directed tree to view" onClick={() => fitToView()} type="button">
          Fit
        </button>
      </div>
      <div className="force-tree-tooltip" ref={tooltipRef} />
    </div>
  );
}
