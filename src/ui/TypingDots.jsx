/* Three bouncing dots — the "Patch is thinking" beat before a reply lands. */
export default function TypingDots() {
  return (
    <span className="typing-dots" role="status" aria-label="Patch is typing">
      <i /><i /><i />
    </span>
  )
}
