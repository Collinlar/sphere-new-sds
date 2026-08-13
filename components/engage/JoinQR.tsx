'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

/**
 * The scan-to-join code for a live game lobby.
 *
 * This sits beside the six-character code rather than replacing it. A
 * projector at the back of a classroom, glare on the screen, a camera that
 * will not focus: the typed code is the fallback that always works, so both
 * stay on screen at equal weight.
 *
 * Error correction is set high because a washed-out projector is exactly the
 * condition low-correction codes fail in.
 */
export default function JoinQR({ joinCode, size = 168 }: { joinCode: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    // Absolute, and taken from the browser the host is actually on. A
    // hardcoded origin would print a localhost link onto a classroom wall.
    const url = `${window.location.origin}/join?code=${encodeURIComponent(joinCode)}`
    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: '#0C1021', light: '#FFFFFF' },
    })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [joinCode, size])

  // No QR is better than a broken one: the code beside it still works, so
  // this simply takes up no space rather than showing an error on a wall.
  if (!dataUrl) return null

  return (
    <div style={{
      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: '#fff', borderRadius: 16, padding: 14,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dataUrl}
        alt={`Scan to join game ${joinCode}`}
        width={size}
        height={size}
        style={{ display: 'block', width: size, height: size }}
      />
    </div>
  )
}
