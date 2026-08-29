import { signal, computed } from '@angular/core';
import { ScrollProperties } from '../../lib/common/interfaces';

export class ChartDataHandler<T, R> {
    public readonly scrollState = signal<ScrollProperties<T> | null>(null);
    public readonly totalCount = signal<number>(0);
    public readonly accumulatedData = signal<T[]>([]);
    public readonly loading = signal<boolean>(false);

    public readonly loadingProgressLabel = computed(() => {
        return `(${this.accumulatedData().length}/${this.totalCount()})`;
    });

    public readonly hasNext = computed(() => {
        const state = this.scrollState();
        return state ? state.metadata.hasNext : true;
    });

    constructor(
        private fetchFn: (req: R, lastId: number | undefined, pageSize: number) => Promise<ScrollProperties<T>>,
        private countFn: (req: R) => Promise<number>,
        private pageSize = 1000
    ) {}

    public async initializeCount(request: R | null): Promise<void> {
        if (!request) return;
        const count = await this.countFn(request);
        this.totalCount.set(count);
    }

    public async resetAndFetchFirstBatch(request: R | null): Promise<void> {
        this.accumulatedData.set([]);
        this.scrollState.set(null);
        await this.loadNextBatch(request);
    }

    public async loadNextBatch(request: R | null): Promise<void> {
        if (this.loading() || !request || !this.hasNext()) return;

        this.loading.set(true);
        try {
            const currentState = this.scrollState();
            const lastId = currentState?.metadata.lastId ?? undefined;
            
            const result = await this.fetchFn(request, lastId, this.pageSize);
            this.accumulatedData.update(current => [...current, ...result.properties]);
            this.scrollState.set(result);
        } finally {
            this.loading.set(false);
        }
    }

    public async loadRemainingPages(request: R | null): Promise<void> {
        if (this.loading() || !request) return;

        this.loading.set(true);
        try {
            let hasNextPage = this.hasNext();
            let currentLastId = this.scrollState()?.metadata.lastId ?? undefined;

            while (hasNextPage) {
                const result = await this.fetchFn(request, currentLastId, this.pageSize);
                this.accumulatedData.update(current => [...current, ...result.properties]);
                this.scrollState.set(result);
                
                hasNextPage = result.metadata.hasNext;
                currentLastId = result.metadata.lastId ?? undefined;
            }
        } finally {
            this.loading.set(false);
        }
    }
}