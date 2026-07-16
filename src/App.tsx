import { useEffect, useMemo, useState } from 'react';
import { hierarchy, tree as d3Tree, type HierarchyNode } from 'd3';
import { loadCorpus } from './lib/loadCorpus';
import type { CorpusNode, DiagramType, RelatedSkillReference, SkillCorpus, SkillRecord, VisibleNode } from './types';
import { TreeView } from './components/TreeView';
import { SunburstView } from './components/SunburstView';
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

function normalizeSearchTerm(value: string) {
  return value.trim().toLowerCase();
}

function matchesSkillQuery(skill: SkillRecord, normalizedQuery: string) {
  if (!normalizedQuery) return true;

  const haystacks = [skill.name, skill.slug, ...skill.tags].map((value) => value.toLowerCase());
  return haystacks.some((value) => value.includes(normalizedQuery));
}

function filterTree(node: CorpusNode, visibleSkillIds: Set<string>): CorpusNode | null {
  if (node.type === 'skill') {
    return node.skillId && visibleSkillIds.has(node.skillId) ? { ...node } : null;
  }

  const filteredChildren = node.children
    ?.map((child) => filterTree(child, visibleSkillIds))
    .filter((child): child is CorpusNode => Boolean(child)) ?? [];

  if (node.type === 'root' || filteredChildren.length > 0) {
    return {
      ...node,
      children: filteredChildren,
    };
  }

  return null;
}

function collectGroupIds(node: CorpusNode, result = new Set<string>()) {
  if (node.children?.length) {
    result.add(node.id);
    node.children.forEach((child) => collectGroupIds(child, result));
  }

  return result;
}

function buildSkillAncestorMap(node: CorpusNode, ancestorIds: string[] = [], result = new Map<string, string[]>()) {
  if (node.type === 'skill' && node.skillId) {
    result.set(node.skillId, ancestorIds);
    return result;
  }

  const nextAncestors = node.children?.length ? [...ancestorIds, node.id] : ancestorIds;
  node.children?.forEach((child) => buildSkillAncestorMap(child, nextAncestors, result));
  return result;
}

function buildRelatedSkillReferences(selectedSkill: SkillRecord | null): RelatedSkillReference[] {
  if (!selectedSkill) return [];

  return selectedSkill.relatedSkills.map((label, index) => ({
    label,
    skillId: selectedSkill.relatedSkillIds?.[index] ?? null,
  }));
}

function App() {
  const [corpus, setCorpus] = useState<SkillCorpus | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['root']));
  const [diagramType, setDiagramType] = useState<DiagramType>('tree');
  const [searchTerm, setSearchTerm] = useState('');
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

  const normalizedSearchTerm = useMemo(() => normalizeSearchTerm(searchTerm), [searchTerm]);

  const filteredSkills = useMemo(() => {
    if (!corpus) return [];
    return corpus.skills.filter((skill) => matchesSkillQuery(skill, normalizedSearchTerm));
  }, [corpus, normalizedSearchTerm]);

  const filteredSkillIds = useMemo(() => new Set(filteredSkills.map((skill) => skill.id)), [filteredSkills]);

  const visibleSkillIds = useMemo(() => {
    const next = new Set(filteredSkillIds);

    if (selectedSkillId) {
      next.add(selectedSkillId);
    }

    return next;
  }, [filteredSkillIds, selectedSkillId]);

  const filteredTree = useMemo(() => {
    if (!corpus) return null;
    return filterTree(corpus.tree, visibleSkillIds);
  }, [corpus, visibleSkillIds]);

  const skillAncestorMap = useMemo(() => {
    if (!corpus) return new Map<string, string[]>();
    return buildSkillAncestorMap(corpus.tree);
  }, [corpus]);

  const selectedSkill = selectedSkillId ? skillsById.get(selectedSkillId) ?? null : null;

  const relatedSkillReferences = useMemo(() => buildRelatedSkillReferences(selectedSkill), [selectedSkill]);

  const relatedSkillIds = useMemo(
    () => new Set(relatedSkillReferences.flatMap((reference) => (reference.skillId ? [reference.skillId] : []))),
    [relatedSkillReferences],
  );

  const effectiveExpandedIds = useMemo(() => {
    const next = new Set(expandedIds);
    next.add('root');

    if (filteredTree && normalizedSearchTerm) {
      collectGroupIds(filteredTree).forEach((id) => next.add(id));
    }

    const emphasizedSkillIds = selectedSkill
      ? [selectedSkill.id, ...relatedSkillReferences.flatMap((reference) => (reference.skillId ? [reference.skillId] : []))]
      : [];

    emphasizedSkillIds.forEach((skillId) => {
      skillAncestorMap.get(skillId)?.forEach((ancestorId) => next.add(ancestorId));
    });

    return next;
  }, [expandedIds, filteredTree, normalizedSearchTerm, relatedSkillReferences, selectedSkill, skillAncestorMap]);

  const visibleNodes = useMemo(() => {
    if (!filteredTree) return [];
    return flattenVisibleNodes(filteredTree, effectiveExpandedIds);
  }, [effectiveExpandedIds, filteredTree]);

  useEffect(() => {
    if (!corpus) return;

    if (filteredSkills.length === 0) {
      if (normalizedSearchTerm) {
        setSelectedSkillId(null);
      }
      return;
    }

    if (!selectedSkillId || !visibleSkillIds.has(selectedSkillId)) {
      setSelectedSkillId(filteredSkills[0].id);
    }
  }, [corpus, filteredSkills, normalizedSearchTerm, selectedSkillId, visibleSkillIds]);

  const handleSelectSkill = (skillId: string) => {
    setSelectedSkillId(skillId);
  };

  const toggleNode = (node: CorpusNode) => {
    if (!node.children?.length) {
      if (node.skillId) {
        handleSelectSkill(node.skillId);
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
          <p className="eyebrow">Phase 1.1</p>
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
            <p>
              {diagramType === 'tree'
                ? 'Search by skill name or tag, then click folders to expand or skills to inspect details.'
                : 'Search by skill name or tag, then scroll or pinch to zoom, drag to pan, click a category arc to zoom in, the center to zoom out, or a skill arc to inspect details.'}
            </p>
          </div>

          <div className="tree-toolbar">
            <div className="diagram-toggle" role="group" aria-label="Diagram type">
              <button
                className={diagramType === 'tree' ? 'active' : ''}
                onClick={() => setDiagramType('tree')}
                type="button"
              >
                Collapsible tree
              </button>
              <button
                className={diagramType === 'sunburst' ? 'active' : ''}
                onClick={() => setDiagramType('sunburst')}
                type="button"
              >
                Zoomable sunburst
              </button>
            </div>
            <label className="search-field" htmlFor="skill-search">
              <span>Search skills</span>
              <input
                id="skill-search"
                type="search"
                placeholder="Try: browser, kubernetes, macos…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <div className="filter-summary">
              <strong>{filteredSkills.length}</strong>
              <span>{filteredSkills.length === corpus.stats.skillCount ? 'all skills visible' : 'matching skills visible'}</span>
            </div>
          </div>

          {filteredTree && visibleNodes.length > 0 ? (
            diagramType === 'tree' ? (
              <TreeView
                expandedIds={effectiveExpandedIds}
                highlightedSkillIds={relatedSkillIds}
                nodes={visibleNodes}
                onNodeClick={toggleNode}
                selectedSkillId={selectedSkillId}
              />
            ) : (
              <SunburstView
                highlightedSkillIds={relatedSkillIds}
                onSelectSkill={handleSelectSkill}
                selectedSkillId={selectedSkillId}
                tree={filteredTree}
              />
            )
          ) : (
            <div className="tree-empty-state">
              <p>No skills matched “{searchTerm}”. Try a different name or tag.</p>
            </div>
          )}
        </section>

        <DetailsPanel
          generatedAt={corpus.generatedAt}
          onSelectSkill={handleSelectSkill}
          relatedSkills={relatedSkillReferences}
          selectedSkill={selectedSkill}
        />
      </main>
    </div>
  );
}

export default App;
