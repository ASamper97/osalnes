interface FooterProps {
  dict: Record<string, string>;
}

export function Footer({ dict }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        padding: '2rem 1rem',
        maxWidth: 'var(--max-width)',
        margin: '0 auto',
        fontSize: '0.875rem',
        color: 'var(--color-muted)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p>&copy; {year} {dict.footer_copyright}</p>
          <p>{dict.footer_funded}</p>
        </div>
        <nav style={{ display: 'flex', gap: '1rem' }}>
          <span>{dict.legal_notice}</span>
          <span>{dict.privacy}</span>
          <span>{dict.cookies}</span>
          <span>{dict.accessibility}</span>
        </nav>
      </div>
    </footer>
  );
}
