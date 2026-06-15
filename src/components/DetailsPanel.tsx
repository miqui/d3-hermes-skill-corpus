import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import type { RelatedSkillReference, SkillRecord } from '../types';

type DetailsPanelProps = {
  selectedSkill: SkillRecord | null;
  generatedAt: string | null;
  relatedSkills: RelatedSkillReference[];
  onSelectSkill: (skillId: string) => void;
};

function renderMarkdown(markdown: string) {
  const rendered = marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  }) as string;

  return DOMPurify.sanitize(rendered, {
    USE_PROFILES: { html: true },
  });
}

export function DetailsPanel({ generatedAt, onSelectSkill, relatedSkills, selectedSkill }: DetailsPanelProps) {
  const markdownPreview = useMemo(
    () => (selectedSkill?.bodyMarkdown ? renderMarkdown(selectedSkill.bodyMarkdown) : ''),
    [selectedSkill?.bodyMarkdown],
  );

  return (
    <aside className="panel details-panel">
      <div className="panel-header">
        <h2>Details</h2>
        <p>{generatedAt ? `Generated ${new Date(generatedAt).toLocaleString()}` : 'No corpus generated yet'}</p>
      </div>

      {selectedSkill ? (
        <div className="details-content">
          <div>
            <p className="eyebrow">{selectedSkill.categoryPath.join(' / ') || 'top level'}</p>
            <h3>{selectedSkill.name}</h3>
            <p className="description">{selectedSkill.description || 'No description provided.'}</p>
          </div>

          <dl className="meta-grid">
            <div>
              <dt>Skill ID</dt>
              <dd>{selectedSkill.id}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{selectedSkill.version || '—'}</dd>
            </div>
            <div>
              <dt>Author</dt>
              <dd>{selectedSkill.author || '—'}</dd>
            </div>
            <div>
              <dt>Source File</dt>
              <dd>{selectedSkill.skillFile}</dd>
            </div>
          </dl>

          <div>
            <h4>Summary</h4>
            <p>{selectedSkill.summary || 'No summary available.'}</p>
          </div>

          <div>
            <h4>Tags</h4>
            <div className="pill-row">
              {selectedSkill.tags.length > 0 ? (
                selectedSkill.tags.map((tag) => (
                  <span className="pill" key={tag}>
                    {tag}
                  </span>
                ))
              ) : (
                <span className="muted">No tags</span>
              )}
            </div>
          </div>

          <div>
            <h4>Related Skills</h4>
            <div className="pill-row">
              {relatedSkills.length > 0 ? (
                relatedSkills.map((relatedSkill) =>
                  relatedSkill.skillId ? (
                    <button
                      className="pill outline interactive"
                      key={`${relatedSkill.label}:${relatedSkill.skillId}`}
                      onClick={() => onSelectSkill(relatedSkill.skillId as string)}
                      type="button"
                    >
                      {relatedSkill.label}
                    </button>
                  ) : (
                    <span className="pill outline" key={relatedSkill.label}>
                      {relatedSkill.label}
                    </span>
                  ),
                )
              ) : (
                <span className="muted">No related skills</span>
              )}
            </div>
          </div>

          <div>
            <h4>Markdown Preview</h4>
            {markdownPreview ? (
              <article className="markdown-preview" dangerouslySetInnerHTML={{ __html: markdownPreview }} />
            ) : (
              <p className="muted">No markdown body available.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p>Select a visible skill node in the hierarchy to inspect it.</p>
        </div>
      )}
    </aside>
  );
}
