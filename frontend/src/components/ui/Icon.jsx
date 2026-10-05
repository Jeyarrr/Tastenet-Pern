export function Icon({ name, ...props }) {
  return <i className={`fa-solid fa-${name}`} aria-hidden="true" {...props} />;
}
