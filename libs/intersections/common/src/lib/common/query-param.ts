import { inject, Injectable } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';


@Injectable({
  providedIn: 'root'
})
export class RouteParamUtilityService {
    private readonly _activatedRoute = inject(ActivatedRoute);
    private readonly _router = inject(Router);

    getInitialParam<T>(key: string, fallback: T, parser?: (val: string) => any): T {
        const snapshotParam = this._activatedRoute.snapshot.queryParamMap.get(key);
        if (snapshotParam === null || snapshotParam === undefined) return fallback;
        return parser ? parser(snapshotParam) : (snapshotParam as unknown as T);
    }

    applyParams(object: object) {
        this._router.navigate([], {
            queryParams: object,
            queryParamsHandling: 'merge',
            replaceUrl: true
        });
    }
}