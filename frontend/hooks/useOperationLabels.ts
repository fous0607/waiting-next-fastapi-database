import { useMemo } from 'react';

export type OperationType = 'general' | 'dining';

interface Labels {
    classLabel: string;      // 교시 vs 시간대
    classAction: string;     // 수업 vs 운영
    waitingLabel: string;    // 대기자 vs 대기 팀
    registerLabel: string;   // 접수 vs 방문 등록
    capacityLabel: string;   // 정원 vs 좌석 수
}

export const useOperationLabels = (operationType: OperationType = 'general'): Labels => {
    const labels = useMemo(() => {
        if (operationType === 'dining') {
            return {
                classLabel: '시간대',
                classAction: '영업',
                waitingLabel: '대기 팀',
                registerLabel: '방문 등록',
                capacityLabel: '가용 좌석'
            };
        }

        // Default: 'general'
        return {
            classLabel: '교시',
            classAction: '수업',
            waitingLabel: '대기자',
            registerLabel: '접수',
            capacityLabel: '정원'
        };
    }, [operationType]);

    return labels;
};
