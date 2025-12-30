'use client';

import React, { useRef, useState, useLayoutEffect } from 'react';

interface AutoResizingTextProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    minScale?: number; // Minimum scale factor (e.g. 0.5 for 50%)
}

export function AutoResizingText({ children, className, minScale = 0.5, style, ...props }: AutoResizingTextProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const container = containerRef.current;
        const text = textRef.current;
        if (!container || !text) return;

        // Reset scale to measure true dimensions
        text.style.transform = 'none';

        const containerWidth = container.clientWidth;
        const textWidth = text.scrollWidth;

        if (textWidth > containerWidth && textWidth > 0) {
            const newScale = Math.max(minScale, containerWidth / textWidth);
            setScale(newScale);
        } else {
            setScale(1);
        }
    }, [children, minScale]);

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden whitespace-nowrap ${className || ''}`}
            style={{ width: '100%', ...style }}
            {...props}
        >
            <span
                ref={textRef}
                style={{
                    display: 'inline-block',
                    transform: `scale(${scale})`,
                    transformOrigin: 'left center',
                    width: scale < 1 ? '100%' : 'auto', // Ensure it doesn't take extra layout space when scaled? Actually usually not needed if origin is left.
                    // When scaling down, the element still occupies original width in flow layout unless we handle it.
                    // But here we are in an overflow-hidden container, visual scaling is what matters.
                }}
            >
                {children}
            </span>
        </div>
    );
}
