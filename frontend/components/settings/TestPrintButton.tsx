import { Button } from '@/components/ui/button';
import { usePrinter } from '@/lib/printer/usePrinter';
import { Loader2, Printer } from 'lucide-react';

export function TestPrintButton({ settings }: { settings?: any }) {
    const { testPrint, isPrinting } = usePrinter();

    const handlePrint = () => {
        testPrint(settings);
    };

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isPrinting}
            className="gap-2"
        >
            {isPrinting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            테스트 출력
        </Button>
    );
}
