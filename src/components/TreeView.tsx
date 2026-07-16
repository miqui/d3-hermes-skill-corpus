import { useCallback, useEffect, useMemo, useRef } from 'react';
import { select, zoom, zoomIdentity, type ZoomBehavior } from 'd3';
import type { CorpusNode, VisibleNode } from '../types';

type TreeViewProps = {
  nodes: VisibleNode[];
  expandedIds: Set<string>;
  highlightedSkillIds: Set<string>;
  selectedSkillId: string | null;
  onNodeClick: (node: CorpusNode) => void;
};

const FIT_PADDING = 48;
const MAX_FIT_SCALE = 1.25;

function nodeColor(node: CorpusNode) {
  if (node.type === 'root') return '#f97316';
  if (node.type === 'group') return '#6366f1';
  return '#10b981';
}

export function TreeView({
  expandedIds,
  highlightedSkillIds,
  nodes,
  onNodeClick,
  selectedSkillId,
}: TreeViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const contentRef = useRef<SVGGElement | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const layoutKey = useMemo(() => nodes.map((node) => node.id).join('|'), [nodes]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.05, 4])
      .on('zoom', (event) => {
        contentRef.current?.setAttribute('transform', event.transform.toString());
      });

    select(svgElement).call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    return () => {
      select(svgElement).on('.zoom', null);
    };
  }, []);

  const fitToView = useCallback((animate = true) => {
    const svgElement = svgRef.current;
    const contentElement = contentRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgElement || !contentElement || !zoomBehavior) return;

    const viewport = svgElement.getBoundingClientRect();
    // getBBox ignores the element's own transform, so this measures the
    // unzoomed layout extent including labels.
    const contentBox = contentElement.getBBox();
    if (!viewport.width || !viewport.height || !contentBox.width || !contentBox.height) return;

    const scale = Math.min(
      (viewport.width - FIT_PADDING) / contentBox.width,
      (viewport.height - FIT_PADDING) / contentBox.height,
      MAX_FIT_SCALE,
    );
    const translateX = (viewport.width - contentBox.width * scale) / 2 - contentBox.x * scale;
    const translateY = (viewport.height - contentBox.height * scale) / 2 - contentBox.y * scale;
    const transform = zoomIdentity.translate(translateX, translateY).scale(scale);

    const selection = select(svgElement);
    if (animate) {
      selection.transition().duration(300).call(zoomBehavior.transform, transform);
    } else {
      selection.call(zoomBehavior.transform, transform);
    }
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const svgElement = svgRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (!svgElement || !zoomBehavior) return;
    select(svgElement).transition().duration(200).call(zoomBehavior.scaleBy, factor);
  }, []);

  useEffect(() => {
    fitToView(false);
  }, [fitToView, layoutKey]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const observer = new ResizeObserver(() => fitToView(false));
    observer.observe(svgElement);
    return () => observer.disconnect();
  }, [fitToView]);

  return (
    <div className="tree-wrapper">
      <svg className="tree-svg" ref={svgRef} role="img">
        <g ref={contentRef}>
          {nodes.map((node) => {
            if (!node.parentId) return null;
            const parent = nodeMap.get(node.parentId);
            if (!parent) return null;

            const midY = (parent.y + node.y) / 2;
            const pathData = `M ${parent.y},${parent.x} C ${midY},${parent.x} ${midY},${node.x} ${node.y},${node.x}`;

            return <path className="tree-link" d={pathData} key={`link:${node.id}`} />;
          })}

          {nodes.map((node) => {
            const isSelected = node.data.skillId === selectedSkillId;
            const isRelated = node.data.skillId ? highlightedSkillIds.has(node.data.skillId) : false;
            const isExpanded = expandedIds.has(node.id);
            const label = node.hasChildren
              ? `${node.data.name} (${isExpanded ? 'collapse' : 'expand'})`
              : node.data.name;
            const nodeClassName = [
              'tree-node',
              isSelected ? 'selected' : '',
              isRelated ? 'related' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <g
                className={nodeClassName}
                key={node.id}
                onClick={() => onNodeClick(node.data)}
                transform={`translate(${node.y}, ${node.x})`}
              >
                <circle
                  className={isSelected ? 'node-circle selected' : isRelated ? 'node-circle related' : 'node-circle'}
                  cx={0}
                  cy={0}
                  fill={nodeColor(node.data)}
                  r={node.data.type === 'skill' ? 9 : 11}
                />
                {node.hasChildren ? (
                  <text className="node-glyph" dy="0.35em" textAnchor="middle" x={0}>
                    {isExpanded ? '−' : '+'}
                  </text>
                ) : null}
                <text className="node-label" dy="0.35em" x={node.depth === 0 ? -18 : 18} textAnchor={node.depth === 0 ? 'end' : 'start'}>
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="tree-controls">
        <button aria-label="Zoom in" onClick={() => zoomBy(1.4)} type="button">
          +
        </button>
        <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)} type="button">
          −
        </button>
        <button aria-label="Fit tree to view" onClick={() => fitToView()} type="button">
          Fit
        </button>
      </div>
    </div>
  );
}
