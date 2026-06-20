import { WritableSignal } from '@angular/core';
import { TableLazyLoadEvent } from 'primeng/table';
import { ESortOrder } from '@simra/common-models';
import { PageableRequest } from './interfaces';


export function onFilterChangeHelper<T extends object>(event: any, requestFilter: WritableSignal<T>) {
    if (!event) return;

    requestFilter.update(current => {
        let hasChanged = false;
        const updatedFilter = { ...current };

        (Object.keys(updatedFilter) as Array<keyof T>).forEach(key => {
            if (key in event) {
                const newValue = event[key] ?? undefined;

                if (updatedFilter[key] !== newValue) {
                    updatedFilter[key] = newValue;
                    hasChanged = true;
                }
            }
        });

        return hasChanged ? updatedFilter : current;
    });
}


/**
 * Called when paginating the table
 * @param event
 */
export function onLazyHelper(event: TableLazyLoadEvent, requestFilter: WritableSignal<PageableRequest>) {
    if (!event.rows || event.first === undefined) return;

    const sortField = event.sortField;
    const order = event.sortOrder === 1 ? ESortOrder.ASC : ESortOrder.DESC;
    const sort = `${sortField},${order}`;

    requestFilter.update(current => ({
        ...current,
        page: event.first! / event.rows!,
        size: event.rows!,
        sort: sort
    }));
}