import { CommonModule } from '@angular/common';
import { Component, signal, model, ViewEncapsulation, effect, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Popover } from 'primeng/popover';
import { Select, SelectLazyLoadEvent, SelectFilterEvent } from 'primeng/select';
import {
	SettingGroup,
	Settings,
	IdListRequest,
	PagedIds
} from '@simra/intersections-common';
import { IntersectionsRequestService } from '@simra/intersections-domain';


@Component({
	selector: 'map-settings',
	imports: [CommonModule, FormsModule, Button, Card, Popover, Select, Settings],
	templateUrl: './map-settings.html',
	styleUrl: './map-settings.scss',
	encapsulation: ViewEncapsulation.None
})
export class MapSettings {
	screenshotMode = model.required<boolean>();

	settings = input.required<SettingGroup[]>();
	isSettingsVisible = signal(false);
    setSettingVisibility(visible: boolean) {
        this.isSettingsVisible.set(visible);
    }

	extendedSettings = input.required<boolean>();
	selectedRideId = model<number | null>();

	selectableRideIds = signal<{id: number, label: string}[]>([]);
	loadingRideIds = signal(false);

	protected readonly rideIdsRequest = signal<IdListRequest>({
		size: 100,
		page: 0
	});

	protected readonly pagedResponse = signal<PagedIds | null>(null);

	constructor(private _requestService: IntersectionsRequestService) {
		effect(async () => {
			if (!this.extendedSettings()) return;
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
