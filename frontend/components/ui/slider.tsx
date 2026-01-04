"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue'> {
    defaultValue?: number[]
    value?: number[]
    max?: number
    min?: number
    step?: number
    onValueChange?: (value: number[]) => void
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
    ({ className, min = 0, max = 100, step = 1, value, defaultValue, onValueChange, ...props }, ref) => {

        // Handle both controlled and uncontrolled state
        const [localValue, setLocalValue] = React.useState<number>(
            (value && value[0]) ?? (defaultValue && defaultValue[0]) ?? 0
        );

        React.useEffect(() => {
            if (value && value.length > 0) {
                setLocalValue(value[0]);
            }
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newVal = Number(e.target.value);
            setLocalValue(newVal);
            onValueChange?.([newVal]);
        };

        return (
            <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={localValue}
                    onChange={handleChange}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    ref={ref}
                    {...props}
                />
            </div>
        )
    }
)
Slider.displayName = "Slider"

export { Slider }
