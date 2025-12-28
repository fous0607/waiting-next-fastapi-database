import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 120,
                    background: '#10b981', // emerald-500
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    borderRadius: '18%', // iOS icon style
                    fontWeight: 800,
                }}
            >
                W
            </div>
        ),
        {
            ...size,
        }
    )
}
