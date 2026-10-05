export default function GlassCard({ children, className = '', hover = false, pad = '', style, ...rest }) {
  return (
    <div className={`glass ${hover ? 'hover' : ''} ${pad} ${className}`} style={style} {...rest}>
      {children}
    </div>
  )
}
