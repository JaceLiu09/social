import { useNavigate } from "react-router-dom";

function renderParagraph(text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function LegalDocumentPage({ doc }) {
  const navigate = useNavigate();
  if (!doc) return null;

  return (
    <main className="legal-page">
      <header className="legal-page-head">
        <button type="button" className="legal-back-btn" onClick={() => navigate(-1)}>
          返回
        </button>
        <h1>{doc.title}</h1>
        <p className="legal-meta">
          更新日期：{doc.updatedAt}　生效日期：{doc.effectiveAt}
        </p>
      </header>
      <article className="legal-body">
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            {(section.paragraphs || []).map((p, idx) => (
              <p key={`p-${idx}`}>{renderParagraph(p)}</p>
            ))}
            {section.list?.length ? (
              <ul>
                {section.list.map((item, idx) => (
                  <li key={`li-${idx}`}>{renderParagraph(item)}</li>
                ))}
              </ul>
            ) : null}
            {(section.paragraphsAfter || []).map((p, idx) => (
              <p key={`pa-${idx}`}>{renderParagraph(p)}</p>
            ))}
          </section>
        ))}
        <p className="legal-footnote">
          本文件为产品合规初稿，正式上架前建议由法务或律师审核；请将文档中的公司全称、地址替换为真实信息。
        </p>
      </article>
    </main>
  );
}
