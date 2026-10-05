export function PageHeader({
  title,
  subtitle,
  children,
  className = "page-header",
  headingTag: Heading = "h2",
}) {
  return (
    <div className={className}>
      <div className="header-title">
        <Heading>{title}</Heading>
        <p>{subtitle}</p>
      </div>
      <div className="header-actions">{children}</div>
    </div>
  );
}
