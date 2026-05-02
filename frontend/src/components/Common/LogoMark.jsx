export default function LogoMark({ className = "h-8 w-8", title = "banboo" }) {
  return <img className={className} src="/app-icon.png" alt={title} draggable="false" />;
}
