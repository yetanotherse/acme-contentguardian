import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Tailwind-styled markdown renderer for lesson content. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-cg text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (props) => (
            <h2 className="text-base font-semibold mt-4 mb-2" {...props} />
          ),
          h3: (props) => (
            <h3 className="text-sm font-semibold mt-3 mb-1.5" {...props} />
          ),
          p: (props) => <p className="my-2" {...props} />,
          ul: (props) => (
            <ul className="my-2 list-disc pl-5 space-y-1" {...props} />
          ),
          ol: (props) => (
            <ol className="my-2 list-decimal pl-5 space-y-1" {...props} />
          ),
          strong: (props) => <strong className="font-semibold" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2"
              {...props}
            />
          ),
          code: (props) => (
            <code
              className="rounded bg-muted px-1 py-0.5 text-[0.8em] font-mono"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border bg-muted px-2 py-1 text-left font-medium"
              {...props}
            />
          ),
          td: (props) => <td className="border px-2 py-1" {...props} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
