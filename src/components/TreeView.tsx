import type { CorpusNode, VisibleNode } from '../types';

type TreeViewProps = {
  nodes: VisibleNode[];
  bounds: {
    width: number;
    height: number;
    minX: number;
  };
  expandedIds: Set<string>;
  highlightedSkillIds: Set<string>;
  selectedSkillId: string | null;
  onNodeClick: (node: CorpusNode) => void;
};

function nodeColor(node: CorpusNode) {
  if (node.type === 'root') return '#f97316';
  if (node.type === 'group') return '#6366f1';
  return '#10b981';
}

export function TreeView({
  bounds,
  expandedIds,
  highlightedSkillIds,
  nodes,
  onNodeClick,
  selectedSkillId,
}: TreeViewProps) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return (
    <div className="tree-wrapper">
      <svg className="tree-svg" viewBox={`0 0 ${bounds.width} ${bounds.height}`} role="img">
        <g transform={`translate(96, ${72 - bounds.minX})`}>
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
    </div>
  );
}
