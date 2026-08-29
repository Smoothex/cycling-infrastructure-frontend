import { Component, effect, input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Divider } from 'primeng/divider';
import { FeatureCollection, GeoJsonProperties,  Polygon } from 'geojson';
import { 
	IntersectionsEdgeRequestService,
	IntersectionsNodeRequestService,
	IntersectionsRegionRequestService
} from '@simra/intersections-domain';
import {
	DateFilterPrecomputedComponent,
	DATE_FILTER_DEFAULTS,
	RegionMetricRow,
	RegionPageableRequest,
	IntersectionChartComponent,
	IntersectionChartMetricComponent,
	BASE_CHART_CONFIG,
	BASE_METRIC_CHART_CONFIG,
	NODE_METRIC_CHART_CONFIG,
	RIDE_CHART_CONFIG,
	RegionMetric,
	REGION_CHART_CONFIG,
	mapFeaturesToRegionMetricRows,
	EdgeRequest,
	NodeRequest,
	NodeMetricRequest,
	EdgeMetricRequest
} from '@simra/intersections-common';
import { BaseIntersectionMapComponent } from '@simra/intersections-map';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';
import { area } from '@turf/turf';


@Component({
	selector: 'intersection-region-detail',
	imports: [CommonModule, FormsModule, ButtonModule, Card, ChartModule, TableModule, Divider, TranslatePipe, RouterLink,
		BaseIntersectionMapComponent, IntersectionChartComponent, IntersectionChartMetricComponent, DateFilterPrecomputedComponent],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetailComponent {
	private readonly _edgeRequestService = inject(IntersectionsEdgeRequestService);
	private readonly _nodeRequestService = inject(IntersectionsNodeRequestService);
	private readonly _regionRequestService = inject(IntersectionsRegionRequestService);

	protected readonly regionRequest = signal<RegionPageableRequest | null>(null);
	protected readonly elementRequest = computed(() => {
		const regionRequest = this.regionRequest();
		const region = this.region();
		if (!regionRequest || !region) return null;
		return {
			...regionRequest,
			regionLTreePath: region.ltreePath
		}
	})

	protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);

	protected readonly trafficSignalClusterId = NaN;
	protected readonly regionId = input<string>();
	protected readonly region = signal<RegionMetricRow | undefined>(undefined);
	protected readonly regionFeature = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);
	protected readonly regionZoom = computed(() => {
		const region = this.region();
		if (!region) return;
		return region.mapLink.params;
	});
	protected readonly regionArea = computed(() => {
		const feature = this.regionFeature();
		if (!feature) return 0;
		return area(feature) / 1000000;
	})
	protected readonly mapLoading = signal<boolean>(true);



	constructor() {
		effect(async () => {
			const regionId = this.regionId();
			if (!regionId) return;

			this.regionRequest.set({
				regionId: Number(regionId),
				numberOfRides: 0,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear(),
				page: 0,
				size: 10,
			});
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.mapLoading.set(true);
			const data = await this._regionRequestService.getIntersectionRegionMetricsPageable(request);
			this.regionFeature.set(data.geoData);
			const regions: RegionMetricRow[] = mapFeaturesToRegionMetricRows(data.geoData);
			if (regions.length === 1) {
				this.region.set(regions[0]);
			}
			this.mapLoading.set(false);
		});
	}


	protected readonly RIDE_CHART_CONFIG = RIDE_CHART_CONFIG;
	protected readonly REGION_CHART_CONFIG = REGION_CHART_CONFIG;
	protected loadRegionMetric = async (req: RegionPageableRequest): Promise<RegionMetric | null> => {
		const data = await this._regionRequestService.getIntersectionRegionMetricsPageableProperties(req);
		if (data.properties.length === 1) return data.properties[0];
		return null;
	};

	protected loadEdgeMetric = (req: EdgeMetricRequest, lastId: number | undefined, pageSize: number) => {
		return this._edgeRequestService.getIntersectionEdgeMetricsPropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadEdgeMetricCount = (req: EdgeMetricRequest) => {
		return this._edgeRequestService.getIntersectionEdgeMetricsPropertiesCount({ ...req });
	};
	
	protected loadNodeMetric = (req: NodeMetricRequest, lastId: number | undefined, pageSize: number) => {
		return this._nodeRequestService.getIntersectionNodeMetricsPropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadNodeMetricCount = (req: NodeMetricRequest) => {
		return this._nodeRequestService.getIntersectionNodeMetricsPropertiesCount({ ...req });
	};

	protected loadEdges = (req: EdgeRequest, lastId: number | undefined, pageSize: number) => {
		return this._edgeRequestService.getIntersectionEdgePropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadEdgesCount = (req: EdgeRequest) => {
		return this._edgeRequestService.getIntersectionEdgePropertiesCount({ ...req });
	};

	protected loadNodes = (req: NodeRequest, lastId: number | undefined, pageSize: number) => {
		return this._nodeRequestService.getIntersectionNodePropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadNodesCount = (req: NodeRequest) => {
		return this._nodeRequestService.getIntersectionNodePropertiesCount({ ...req });
	};

	protected loadRides = (req: NodeRequest, lastId: number | undefined, pageSize: number) => {
		return this._regionRequestService.getIntersectionRideRegionMetricsPropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadRidesCount = (req: NodeRequest) => {
		return this._regionRequestService.getIntersectionRideRegionMetricsPropertiesCount({ ...req });
	};

	protected readonly baseConfig = BASE_CHART_CONFIG;
	protected readonly BASE_METRIC_CHART_CONFIG = BASE_METRIC_CHART_CONFIG;
	protected readonly NODE_METRIC_CHART_CONFIG = NODE_METRIC_CHART_CONFIG;
}
