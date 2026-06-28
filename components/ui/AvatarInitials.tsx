interface AvatarInitialsProps {
  initials: string
  size?: number
  background?: string
  color?: string
}

export default function AvatarInitials({
  initials,
  size = 36,
  background = 'var(--bg2)',
  color = 'var(--mid-grey)',
}: AvatarInitialsProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.35,
        fontWeight: 700,
        color,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}
