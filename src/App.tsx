import { useEffect, useMemo, useState } from 'react';
import { hierarchy, tree as d3Tree, type HierarchyNode } from 'd3';
import { loadCorpus } from './lib/loadCorpus';
import type { CorpusNode, SkillCorpus, SkillRecord, VisibleNode } from './types';
import { TreeView } from './components/TreeView';
import { DetailsPanel } from './components/DetailsPanel';

function collectExpandedIds(node: CorpusNode, depth = 0, result = new Set<string>()) {
  if (depth <= 1) {
    result.add(node.id);
  }

  node.children?.forEach((child) => collectExpandedIds(child, depth + 1, result));
  return result;
}

function flattenVisibleNodes(node: CorpusNode, expandedIds: Set<string>): VisibleNode[] {
  const root = hierarchy(node, (current: CorpusNode) => {
    if (!current.children?.length) return null;
    return expandedIds.has(current.id) ? current.children : null;
  });

  const layout = d3Tree<CorpusNode>().nodeSize([36, 240]);
  const positionedRoot = layout(root);

  return positionedRoot.descendants().map((entry: HierarchyNode<CorpusNode>) => ({
    id: entry.data.id,
    x: entry.x ?? 0,
    y: entry.y ?? 0,
    depth: entry.depth,
    data: entry.data,
    parentId: entry.parent?.data.id,
    hasChildren: Boolean(entry.data.children?.length),
  }));
}

function App() {
  const [corpus, setCorpus] = useState<SkillCorpus | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root']));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCorpus()
      .then((loadedCorpus) => {
        setCorpus(loadedCorpus);
        setExpandedIds(collectExpandedIds(loadedCorpus.tree));
        setSelectedSkillId(loadedCorpus.skills[0]?.id ?? null);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load corpus');
      });
  }, []);

  const skillsById = useMemo(() => {
    const map = new Map<string, SkillRecord>();
    corpus?.skills.forEach((skill: SkillRecord) => map.set(skill.id, skill));
    return map;
  }, [corpus]);

  const selectedSkill = selectedSkillId ? skillsById.get(selectedSkillId) ?? null : null;

  const visibleNodes = useMemo(() => {
    if (!corpus) return [];
    return flattenVisibleNodes(corpus.tree, expandedIds);
  }, [corpus, expandedIds]);

  const bounds = useMemo(() => {
    if (visibleNodes.length === 0) {
      return { width: 800, height: 320, minX: 0 };
    }

    const minX = Math.min(...visibleNodes.map((node: VisibleNode) => node.x));
    const maxX = Math.max(...visibleNodes.map((node: VisibleNode) => node.x));
    const maxY = Math.max(...visibleNodes.map((node: VisibleNode) => node.y));

    return {
      width: maxY + 320,
      height: maxX - minX + 160,
      minX,
    };
  }, [visibleNodes]);

  const toggleNode = (node: CorpusNode) => {
    if (!node.children?.length) {
      if (node.skillId) {
        setSelectedSkillId(node.skillId);
      }
      return;
    }

    setExpandedIds((current: Set<string>) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  };

  if (error) {
    return <div className="app-shell"><p className="status-card error">{error}</p></div>;
  }

  if (!corpus) {
    return <div className="app-shell"><p className="status-card">Loading Hermes skill corpus…</p></div>;
  }

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Phase 1 MVP</p>
          <h1>Hermes Skill Corpus Explorer</h1>
          <p className="subtitle">
            Local D3 hierarchy explorer for skills generated from <code>{corpus.sourceRoot}</code>
          </p>
        </div>
        <div className="stats-grid">
          <div>
            <strong>{corpus.stats.skillCount}</strong>
            <span>skills</span>
          </div>
          <div>
            <strong>{corpus.stats.nodeCount}</strong>
            <span>nodes</span>
          </div>
          <div>
            <strong>{corpus.stats.maxDepth}</strong>
            <span>max depth</span>
          </div>
        </div>
      </header>

      <main className="layout-grid">
        <section className="panel tree-panel">
          <div className="panel-header">
            <h2>Hierarchy</h2>
            <p>Click folders to expand/collapse. Click skills to inspect details.</p>
          </div>
          <TreeView
            bounds={bounds}
            expandedIds={expandedIds}
            nodes={visibleNodes}
            onNodeClick={toggleNode}
            selectedSkillId={selectedSkillId}
          />
        </section>

        <DetailsPanel selectedSkill={selectedSkill} generatedAt={corpus.generatedAt} />
      </main>
    </div>
  );
}

export default App;
