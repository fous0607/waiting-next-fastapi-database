import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateRange as DayPickerRange } from 'react-day-picker';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface DateRangeStrings {
    start: string;
    end: string;
}

interface DateRangeSelectorProps {
    onRangeChange: (range: DateRangeStrings) => void;
    initialRange?: string;
    selectedRange?: DateRangeStrings;
}

const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({ onRangeChange, initialRange = 'today', selectedRange }) => {
    const [activeRange, setActiveRange] = useState(initialRange);
    const [range, setRange] = useState<DateRangeStrings>({ start: '', end: '' });
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarDate, setCalendarDate] = useState<DayPickerRange | undefined>();

    const calculateDateRange = (rangeType: string): DateRangeStrings => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let start = new Date(today);
        let end = new Date(today);

        switch (rangeType) {
            case 'yesterday':
                start.setDate(today.getDate() - 1);
                end.setDate(today.getDate() - 1);
                break;
            case 'last_week': {
                const lastWeekEnd = new Date(today);
                lastWeekEnd.setDate(today.getDate() - today.getDay());
                const lastWeekStart = new Date(lastWeekEnd);
                lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
                start = lastWeekStart;
                end = lastWeekEnd;
                break;
            }
            case 'this_week':
                start.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
                break;
            case 'last_month':
                start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                end = new Date(today.getFullYear(), today.getMonth(), 0);
                break;
            case 'this_month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            case 'today':
            default:
                break;
        }

        return {
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
        };
    };

    // Watch for external changes
    useEffect(() => {
        if (selectedRange && (selectedRange.start !== range.start || selectedRange.end !== range.end)) {
            setRange(selectedRange);
            setCalendarDate({
                from: new Date(selectedRange.start),
                to: new Date(selectedRange.end)
            });
            // Do NOT call onRangeChange here to avoid loop if parent passed it down
        }
    }, [selectedRange]);

    useEffect(() => {
        const initial = calculateDateRange(initialRange);
        if (!selectedRange) {
            setRange(initial);
            setCalendarDate({
                from: new Date(initial.start),
                to: new Date(initial.end)
            });
            onRangeChange(initial);
        }
    }, []);

    const handleQuickSelect = (rangeType: string) => {
        setActiveRange(rangeType);
        const newRange = calculateDateRange(rangeType);
        setRange(newRange);
        setCalendarDate({
            from: new Date(newRange.start),
            to: new Date(newRange.end)
        });
        onRangeChange(newRange);
        setShowCalendar(false);
    };

    const handleCalendarSelect = (newRange: DayPickerRange | undefined) => {
        setCalendarDate(newRange);

        if (newRange?.from) {
            setActiveRange('custom');
            const startStr = format(newRange.from, 'yyyy-MM-dd');
            const endStr = newRange.to ? format(newRange.to, 'yyyy-MM-dd') : startStr;

            const newDateRange = { start: startStr, end: endStr };
            setRange(newDateRange);

            // Only trigger update if we have both dates or it's a single date selection mode (but here we effectively treat single click as start=end if 'to' is undefined, ensuring valid range)
            if (newRange.to || !newRange.to) {
                onRangeChange(newDateRange);
            }
        }
    };

    // Toggle calendar visibility
    const toggleCalendar = () => {
        setShowCalendar(!showCalendar);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        handleQuickSelect('today');
    };

    const presets = [
        { id: 'yesterday', label: '어제' },
        { id: 'today', label: '오늘' },
        { id: 'last_week', label: '지난 주' },
        { id: 'this_week', label: '이번 주' },
        { id: 'last_month', label: '지난 달' },
        { id: 'this_month', label: '이번 달' },
    ];

    return (
        <div className="flex flex-wrap items-center gap-3 relative">
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                {presets.map((preset) => (
                    <button
                        key={preset.id}
                        onClick={() => handleQuickSelect(preset.id)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                            activeRange === preset.id
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-slate-500 hover:text-slate-900"
                        )}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            <div
                className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer hover:border-blue-400 transition-colors relative"
                onClick={toggleCalendar}
            >
                <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-slate-400" />
                    <span>{range.start ? range.start.replace(/-/g, '.') : ''}</span>
                    <span className="text-slate-300">~</span>
                    <span>{range.end ? range.end.replace(/-/g, '.') : ''}</span>
                </div>
                {activeRange !== 'today' && (
                    <button
                        onClick={handleClear}
                        className="ml-1 text-slate-400 hover:text-red-500 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {showCalendar && (
                <div className="absolute top-full left-0 mt-2 z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 p-2 animate-in fade-in zoom-in-95 duration-200">
                    <Calendar
                        mode="range"
                        defaultMonth={calendarDate?.from}
                        selected={calendarDate}
                        onSelect={handleCalendarSelect}
                        numberOfMonths={2}
                        className="rounded-lg border shadow-sm"
                    />
                    <div className="flex justify-end p-2 border-t border-slate-100">
                        <Button variant="ghost" size="sm" onClick={() => setShowCalendar(false)}>닫기</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DateRangeSelector;
