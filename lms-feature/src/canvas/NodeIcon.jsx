import {
  Zap, Filter, Send, Database, Clock, Globe, GitBranch, Sparkles, HelpCircle, FileText, Mail,
} from 'lucide-react'

const MAP = {
  trigger: Zap,
  action: Send,
  logic: Filter,
  data: Database,
  wait: Clock,
  http: Globe,
  branch: GitBranch,
  ai: Sparkles,
  sheet: FileText,
  email: Mail,
  slot: HelpCircle,
}

export default function NodeIcon({ kind, size = 15 }) {
  const Icon = MAP[kind] || HelpCircle
  return <Icon size={size} strokeWidth={2.2} />
}
