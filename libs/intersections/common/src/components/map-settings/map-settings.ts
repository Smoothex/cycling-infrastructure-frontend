import { CommonModule } from '@angular/common';
import { Component, signal, model, ViewEncapsulation, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Card } from 'primeng/card';
import { Panel } from 'primeng/panel';
import { Popover } from 'primeng/popover';
import { Select, SelectLazyLoadEvent, SelectFilterEvent } from 'primeng/select';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { 
	DateFilterPrecomputed, 
	DATE_FILTER_DEFAULTS,
	IdListRequest,
	PagedIds
} from '@simra/intersections-common';
import { IntersectionsRequestService } from '@simra/intersections-domain';


@Component({
	selector: 'map-settings',
	imports: [
		CommonModule,
		FormsModule,
		Button,
		Checkbox,
		Card,
		Panel,
		Popover,
		Select,
		DateFilterPrecomputed
	],
	templateUrl: './map-settings.html',
	styleUrl: './map-settings.scss',
	encapsulation: ViewEncapsulation.None
})
export class MapSettings {
	showTrafficSignals = model<boolean>(true);
	showIntersectionMetrics = model<boolean>(true);

	selectedRideId = model<number | null>(null);

    selectedYear = model<EYear>(DATE_FILTER_DEFAULTS.year);
    selectedWeekDays = model<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    selectedTrafficTime = model<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);

	selectableRideIds = signal<{id: number, label: string}[]>([]);
	loadingRideIds = signal(false);

	protected readonly rideIdsRequest = signal<IdListRequest>({
		size: 100,
		page: 0
	});

	protected readonly pagedResponse = signal<PagedIds | null>(null);

	constructor(private _requestService: IntersectionsRequestService) {
		effect(async () => {
			const request = this.rideIdsRequest();
			const currentSelected = this.selectedRideId();

			this.loadingRideIds.set(true);

			const response = await this._requestService.getIds({
				...request,
				id: request.id || currentSelected || undefined
			});
			const newItems = response.ids.map(id => ({ id, label: `${id}` }));
			
			if (request.page === 0) {
				this.selectableRideIds.set(newItems);
			} else {
				this.selectableRideIds.update(current => [...current, ...newItems]);
			}

			this.pagedResponse.set(response);
			this.loadingRideIds.set(false);
		})
	}

	async loadRides(event: SelectLazyLoadEvent) {
		const request = this.rideIdsRequest();
		const response = this.pagedResponse();
		if (!response) return;

		const pageSize = request.size;
	    const targetPage = Math.floor(event.last / pageSize);

		if (targetPage > request.page && targetPage < response.metadata.totalPages) {
			this.rideIdsRequest.update(current => ({
				...current,
				page: targetPage
			}));
		}
	}

	filterRides(event: SelectFilterEvent) {
		const filter = Number(event.filter);
		this.rideIdsRequest.update(current => ({
			...current,
			page: 0,
			id: filter
		}))
	}
}
