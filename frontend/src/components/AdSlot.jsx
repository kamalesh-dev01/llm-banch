import React, { useEffect, useRef } from 'react'

/**
 * AdSlot component compliant with AdSense layout policies.
 * - Reserves fixed height to prevent layout shifts.
 * - Shows subtle dashed placeholder in development if VITE_ADSENSE_CLIENT is not configured.
 * - Safely initializes adsbygoogle once when client ID is provided.
 */
export default function AdSlot({ slot, format = 'inline', className = '' }) {
  const adClient = import.meta.env.VITE_ADSENSE_CLIENT
  const isDev = import.meta.env.DEV
  const adRef = useRef(null)
  const isPushed = useRef(false)

  useEffect(() => {
    if (adClient && adRef.current && !isPushed.current) {
      try {
        const adsbygoogle = window.adsbygoogle || []
        adsbygoogle.push({})
        isPushed.current = true
      } catch (err) {
        console.error('AdSense push error:', err)
      }
    }
  }, [adClient])

  // Format styles & sizes to guarantee zero layout shift
  const formatConfig = {
    banner: {
      heightClass: 'h-[90px]',
      sizeLabel: '728 x 90 Banner',
      adFormat: 'horizontal',
    },
    rectangle: {
      heightClass: 'h-[250px]',
      sizeLabel: '300 x 250 Rectangle',
      adFormat: 'rectangle',
    },
    inline: {
      heightClass: 'h-[100px]',
      sizeLabel: 'Responsive In-Feed',
      adFormat: 'auto',
    },
  }

  const currentConfig = formatConfig[format] || formatConfig.inline

  // If no AdSense client is set and not in development, do not render
  if (!adClient && !isDev) {
    return null
  }

  return (
    <div className={`w-full my-8 flex flex-col items-center justify-center ${className}`}>
      {/* AdSense policy required label */}
      <span className="text-[10px] uppercase font-mono tracking-widest text-muted/70 mb-1.5 self-center">
        Advertisement
      </span>

      {adClient ? (
        <div className={`w-full ${currentConfig.heightClass} overflow-hidden flex items-center justify-center`}>
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: 'block', width: '100%', height: '100%' }}
            data-ad-client={adClient}
            data-ad-slot={slot || '1234567890'}
            data-ad-format={currentConfig.adFormat}
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        /* Development placeholder */
        <div
          className={`w-full max-w-4xl ${currentConfig.heightClass} rounded-lg border border-dashed border-border/80 bg-surface/50 flex flex-col items-center justify-center text-muted transition hover:border-accent/40`}
        >
          <span className="text-xs font-mono font-medium tracking-wide text-muted">
            Ad space &bull; {currentConfig.sizeLabel}
          </span>
          {slot && (
            <span className="text-[10px] font-mono text-muted/60 mt-1">
              slot: {slot}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
