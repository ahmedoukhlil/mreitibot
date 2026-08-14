"use client";
import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

interface Props {
  code: string;
  language: string;
  closed: boolean;
}

export default function CodeBlock({ code, language, closed }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API indisponible, ignore silencieusement.
    }
  };

  return (
    <div className="code-block">
      <div className="code-block-header">
        <span className="code-block-lang">{language || "text"}</span>
        {closed && (
          <button type="button" className="code-block-copy" onClick={handleCopy}>
            {copied ? "Copié" : "Copier"}
          </button>
        )}
      </div>
      <Highlight code={code} language={language || "text"} theme={themes.nightOwl}>
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre className="code-block-pre" style={style}>
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}
