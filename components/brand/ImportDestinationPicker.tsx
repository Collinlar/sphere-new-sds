'use client'

import { useState } from 'react'
import {
  destinationLabel,
  getDefaultImportDestination,
  getImportDestinations,
  saveImportDestination,
  type ImportDestination,
} from '@/lib/library-scope'

interface ImportDestinationPickerProps {
  value: ImportDestination
  onChange: (destination: ImportDestination) => void
  compact?: boolean
}

export default function ImportDestinationPicker({
  value,
  onChange,
  compact = false,
}: ImportDestinationPickerProps) {
  const destinations = getImportDestinations()

  if (destinations.length <= 1) return null

  function handleSelect(destination: ImportDestination) {
    saveImportDestination(destination)
    onChange(destination)
  }

  return (
    <div style={{ marginBottom: compact ? 12 : 16 }}>
      <p style={{
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--mid-grey)',
        marginBottom: 8,
      }}>
        Save to
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {destinations.map((dest) => {
          const selected =
            dest.kind === value.kind &&
            (dest.kind === 'personal' ||
              (dest.kind === 'institution' &&
                value.kind === 'institution' &&
                dest.institutionId === value.institutionId))

          return (
            <button
              key={dest.kind === 'personal' ? 'personal' : dest.institutionId}
              type="button"
              onClick={() => handleSelect(dest)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: compact ? '8px 12px' : '10px 14px',
                borderRadius: 8,
                border: selected ? '1.5px solid var(--teal)' : '1px solid var(--border)',
                background: selected ? 'var(--teal-light)' : 'var(--white)',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font)',
              }}
            >
              <span style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: selected ? '4px solid var(--teal)' : '1.5px solid var(--border)',
                flexShrink: 0,
                boxSizing: 'border-box',
              }} />
              <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--near-black)' }}>
                {destinationLabel(dest)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function useImportDestination(): [ImportDestination, (d: ImportDestination) => void] {
  const [destination, setDestination] = useState<ImportDestination>(() => getDefaultImportDestination())
  return [destination, setDestination]
}
