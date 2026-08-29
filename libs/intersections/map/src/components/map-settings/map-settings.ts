
import { Component, signal, model, ViewEncapsulation, input, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Popover } from 'primeng/popover';
import { Divider } from 'primeng/divider';
import { Listbox, ListboxFilterEvent } from 'primeng/listbox';
import {
	SettingGroup,
	SettingsDrawerComponent,
	IdListRequest,
} from '@simra/intersections-common';
import { IntersectionsRideRequestService } from '@simra/intersections-domain';


@Component({
	selector: 'intersection-map-settings',
	imports: [FormsModule, Button, Card, Divider, Listbox, Popover, SettingsDrawerComponent],
	templateUrl: './map-settings.html',
	styleUrl: './map-settings.scss',
	encapsulation: ViewEncapsulation.None
})
export class MapSettingsComponent {
	private _requestService = inject(IntersectionsRideRequestService);

	screenshotMode = model.required<boolean>();
	fullscreenMode = model.required<boolean>();

	sidebarVisible = signal<boolean>(false);
	settings = input.required<SettingGroup[]>();
	extendedSettings = input.required<boolean>();

	selectedRideId = model<number | null>();
	selectableRideIds = signal<{id: number, label: string}[]>([]);

	protected totalPages = -1;
	protected rideIdsRequest: IdListRequest = {
		size: 100,
		page: 0
	};

	constructor () {
		this.loadIds();
	}

	async updatePage(event: any) {
		if (this.totalPages > 0) {
			const targetPage = Math.floor(event.last / this.rideIdsRequest.size);
			if (targetPage > this.rideIdsRequest.page && targetPage < this.totalPages) {
				this.rideIdsRequest = {
					...this.rideIdsRequest,
					page: targetPage
				}
			} else {
				return; // No update, no page loading
			}
		}

		await this.loadIds();
	}

	async filterRides(event: ListboxFilterEvent) {
		const filter = Number(event.filter);
		this.rideIdsRequest = {
			...this.rideIdsRequest,
			id: filter
		}

		await this.loadIds();
	}

	async loadIds () {
		const response = await this._requestService.getIds({
			...this.rideIdsRequest,
			id: this.rideIdsRequest.id || this.selectedRideId() || undefined
		});
		this.totalPages = response.metadata.totalPages;

		const newItems = response.ids.map(id => ({ id, label: `${id}` }));
		if (this.rideIdsRequest.page === 0) {
			this.selectableRideIds.set(newItems);
		} else {
			this.selectableRideIds.update(current => [...current, ...newItems]);
		}
	}
}
