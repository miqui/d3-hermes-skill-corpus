export type SkillRecord = {
  id: string;
  slug: string;
  name: string;
  folderName: string;
  categoryPath: string[];
  path: string;
  skillFile: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  relatedSkills: string[];
  summary: string;
  modifiedAt: string;
};

export type CorpusNode = {
  id: string;
  name: string;
  type: 'root' | 'group' | 'skill';
  path: string;
  children?: CorpusNode[];
  skillId?: string;
  description?: string;
  tags?: string[];
  relatedSkills?: string[];
};

export type SkillCorpus = {
  generatedAt: string | null;
  sourceRoot: string;
  stats: {
    skillCount: number;
    nodeCount: number;
    maxDepth: number;
  };
  skills: SkillRecord[];
  tree: CorpusNode;
};

export type VisibleNode = {
  id: string;
  x: number;
  y: number;
  depth: number;
  data: CorpusNode;
  parentId?: string;
  hasChildren: boolean;
};
